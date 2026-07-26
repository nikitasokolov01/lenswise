import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "frame-catalog-images";
const LOCAL_MIRROR_DIRECTORY = ".frame-image-mirror";
const DATABASE_PAGE_SIZE = 1000;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_ATTEMPTS = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// This one-off worker uses only PostgREST and Storage. Supplying a transport
// prevents supabase-js from requiring Node 22's native WebSocket for an unused
// Realtime client.
class DisabledRealtimeTransport {}

function loadLocalEnvironment() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(scriptDirectory, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] != null) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env.local.`);
  return value;
}

function positiveInteger(value, fallback, label, maximum) {
  const parsed = value == null ? fallback : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum}.`);
  }
  return parsed;
}

function cliOptions(argv) {
  const options = {
    concurrency: DEFAULT_CONCURRENCY,
    attempts: DEFAULT_ATTEMPTS,
    limit: null,
    dryRun: false,
    retryFailed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--concurrency") {
      options.concurrency = positiveInteger(
        argv[++index],
        DEFAULT_CONCURRENCY,
        "--concurrency",
        24
      );
    } else if (argument === "--attempts") {
      options.attempts = positiveInteger(
        argv[++index],
        DEFAULT_ATTEMPTS,
        "--attempts",
        10
      );
    } else if (argument === "--limit") {
      options.limit = positiveInteger(argv[++index], null, "--limit", 100_000);
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--retry-failed") {
      options.retryFailed = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return options;
}

function extensionForUrl(value) {
  try {
    const extension = path.extname(new URL(value).pathname).toLowerCase();
    if (extension === ".jpeg") return ".jpg";
    if ([".jpg", ".png", ".webp", ".gif"].includes(extension)) {
      return extension;
    }
  } catch {}
  return ".jpg";
}

export function mirrorObjectPath(sourceUrl) {
  const digest = crypto.createHash("sha256").update(sourceUrl).digest("hex");
  return `frames-data/${digest.slice(0, 2)}/${digest}${extensionForUrl(sourceUrl)}`;
}

export function contentTypeForPath(value) {
  switch (path.extname(value).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function placeholderImage(value) {
  return /\/imgnotavail(?:_|\.|\/)/i.test(value);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchImage(sourceUrl, attempts) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
          "user-agent": "LensWise licensed catalog image mirror",
        },
      });
      if (!response.ok) {
        throw new Error(`Source returned HTTP ${response.status}.`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error("Source returned an empty image.");
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error("Source image exceeds the 2 MB safety limit.");
      }

      const headerType =
        response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ??
        "";
      const contentType = ALLOWED_CONTENT_TYPES.has(headerType)
        ? headerType
        : contentTypeForPath(sourceUrl);
      return { bytes, contentType };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(400 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Source image could not be downloaded.");
}

function localPathForObject(objectPath) {
  return path.resolve(process.cwd(), LOCAL_MIRROR_DIRECTORY, objectPath);
}

function saveLocalFile(localPath, bytes) {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  const temporaryPath = `${localPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, bytes);
  fs.renameSync(temporaryPath, localPath);
}

function duplicateStorageError(error) {
  const status = Number(error?.statusCode ?? error?.status ?? 0);
  return status === 409 || /duplicate|already exists/i.test(error?.message ?? "");
}

async function loadCatalogRows(admin) {
  const rows = [];
  for (let offset = 0; ; offset += DATABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from("frame_catalog_items")
      .select(
        "id,image_url,source_image_url,hosted_image_path,image_sync_status"
      )
      .eq("provider", "frames_data")
      .eq("is_active", true)
      .order("id")
      .range(offset, offset + DATABASE_PAGE_SIZE - 1);

    if (error) throw new Error(`Catalog rows could not be loaded: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) break;
  }
  return rows;
}

function groupBySource(rows, retryFailed) {
  const groups = new Map();
  for (const row of rows) {
    const sourceUrl = row.source_image_url ?? row.image_url;
    if (!sourceUrl) continue;
    if (!retryFailed && row.image_sync_status === "failed") continue;

    const existing = groups.get(sourceUrl);
    if (existing) existing.push(row);
    else groups.set(sourceUrl, [row]);
  }
  return Array.from(groups, ([sourceUrl, variants]) => ({
    sourceUrl,
    variants,
  }));
}

async function updateSourceRows(admin, sourceUrl, values) {
  const { error } = await admin
    .from("frame_catalog_items")
    .update(values)
    .eq("provider", "frames_data")
    .eq("source_image_url", sourceUrl);
  if (error) throw new Error(`Catalog image state could not be saved: ${error.message}`);
}

async function processGroup(admin, group, options) {
  const { sourceUrl, variants } = group;
  if (placeholderImage(sourceUrl)) {
    if (!options.dryRun) {
      await updateSourceRows(admin, sourceUrl, {
        image_sync_status: "missing",
        image_sync_error: null,
      });
    }
    return { status: "missing", bytes: 0 };
  }

  const objectPath = mirrorObjectPath(sourceUrl);
  const localPath = localPathForObject(objectPath);
  const allAlreadySynced = variants.every(
    (variant) =>
      variant.image_sync_status === "synced" &&
      variant.hosted_image_path === objectPath
  );

  let bytes;
  let contentType = contentTypeForPath(objectPath);
  let downloaded = false;
  if (fs.existsSync(localPath)) {
    bytes = new Uint8Array(fs.readFileSync(localPath));
  } else {
    const downloadedImage = await fetchImage(sourceUrl, options.attempts);
    bytes = downloadedImage.bytes;
    contentType = downloadedImage.contentType;
    downloaded = true;
    if (!options.dryRun) saveLocalFile(localPath, bytes);
  }

  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  if (options.dryRun) {
    return { status: downloaded ? "downloaded" : "local", bytes: bytes.byteLength };
  }

  if (!allAlreadySynced) {
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError && !duplicateStorageError(uploadError)) {
      throw new Error(`Hosted upload failed: ${uploadError.message}`);
    }
  }

  await updateSourceRows(admin, sourceUrl, {
    hosted_image_path: objectPath,
    image_mime_type: contentType,
    image_byte_size: bytes.byteLength,
    image_checksum_sha256: checksum,
    image_sync_status: "synced",
    image_synced_at: new Date().toISOString(),
    image_sync_error: null,
  });

  return {
    status: allAlreadySynced ? "verified" : downloaded ? "mirrored" : "resumed",
    bytes: bytes.byteLength,
  };
}

async function ensurePrivateBucket(admin) {
  const { data, error } = await admin.storage.getBucket(BUCKET);
  if (!error && data) {
    if (data.public) throw new Error(`${BUCKET} must remain private.`);
    return;
  }

  const { error: createError } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_CONTENT_TYPES),
  });
  if (createError) {
    throw new Error(`Private image bucket could not be created: ${createError.message}`);
  }
}

async function main() {
  loadLocalEnvironment();
  const options = cliOptions(process.argv.slice(2));
  const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: DisabledRealtimeTransport },
  });

  if (!options.dryRun) await ensurePrivateBucket(admin);
  const rows = await loadCatalogRows(admin);
  let groups = groupBySource(rows, options.retryFailed);
  if (options.limit != null) groups = groups.slice(0, options.limit);

  console.log(
    `Mirroring ${groups.length} unique images from ${rows.length} active catalog variants with concurrency ${options.concurrency}.`
  );

  const counters = {
    processed: 0,
    mirrored: 0,
    resumed: 0,
    verified: 0,
    local: 0,
    downloaded: 0,
    missing: 0,
    failed: 0,
    bytes: 0,
  };
  let cursor = 0;

  async function worker() {
    while (cursor < groups.length) {
      const index = cursor;
      cursor += 1;
      const group = groups[index];
      try {
        const result = await processGroup(admin, group, options);
        counters[result.status] += 1;
        counters.bytes += result.bytes;
      } catch (error) {
        counters.failed += 1;
        const message =
          error instanceof Error ? error.message.slice(0, 1000) : "Image mirror failed.";
        if (!options.dryRun) {
          await updateSourceRows(admin, group.sourceUrl, {
            image_sync_status: "failed",
            image_sync_error: message,
          }).catch(() => {});
        }
        console.error(`Failed ${group.sourceUrl}: ${message}`);
      } finally {
        counters.processed += 1;
        if (counters.processed % 100 === 0 || counters.processed === groups.length) {
          console.log(
            `Processed ${counters.processed}/${groups.length}; mirrored ${counters.mirrored}, resumed ${counters.resumed}, verified ${counters.verified}, failed ${counters.failed}.`
          );
        }
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, worker));
  const manifest = {
    completedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    activeCatalogVariants: rows.length,
    uniqueImagesConsidered: groups.length,
    ...counters,
  };
  if (!options.dryRun) {
    const manifestPath = path.resolve(
      process.cwd(),
      LOCAL_MIRROR_DIRECTORY,
      "manifest.json"
    );
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }
  console.log(JSON.stringify(manifest, null, 2));
  if (counters.failed > 0) process.exitCode = 1;
}

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Image mirror failed.");
    process.exitCode = 1;
  });
}
