import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRAMES_DATA_ORIGIN = "https://www.framesdata.com";
const DEFAULT_IMPORT_URL =
  "http://127.0.0.1:3000/api/catalog/frames-data/import";
const DEFAULT_LIMIT = 100;
const DEFAULT_DELAY_MS = 150;
const SEARCH_PAGE_SIZE = 48;
const IMPORT_BATCH_SIZE = 100;
const MAX_SEARCH_PAGES = 500;
const IMPORT_CACHE_DIRECTORY = ".frames-data-cache";

export const MODERN_OPTICAL_COLLECTIONS = Object.freeze([
  { id: "10800", name: "Genevieve Paris Design" },
  { id: "1088", name: "Genevieve Boutique" },
  { id: "1089", name: "Giovani di Venezia" },
  { id: "2585", name: "Modern Metals" },
  { id: "10611", name: "Modern Plastics I" },
  { id: "11559", name: "Modern Plastics II" },
  { id: "2899", name: "ModZ" },
]);

export const EXPANDED_CATALOG_TARGETS = Object.freeze([
  { filter: "collection", id: "12730", name: "DOLCE & GABBANA" },
  { filter: "collection", id: "17886", name: "JIMMY CHOO" },
  { filter: "collection", id: "6210", name: "Miu Miu" },
  { filter: "collection", id: "13416", name: "Oakley" },
  { filter: "collection", id: "14123", name: "Oakley Frame" },
  { filter: "collection", id: "5931", name: "Prada" },
  { filter: "collection", id: "12211", name: "Prada Linea Rossa" },
  { filter: "collection", id: "9303", name: "Ray-Ban" },
  { filter: "collection", id: "17518", name: "RAY-BAN META" },
  { filter: "collection", id: "5801", name: "Ray-Ban RX" },
  { filter: "collection", id: "17609", name: "SWAROVSKI" },
  { filter: "collection", id: "14425", name: "Tiffany" },
  { filter: "collection", id: "5872", name: "Versace" },
  { filter: "collection", id: "9815", name: "BOSS BLACK Collection" },
  { filter: "collection", id: "17244", name: "Carolina Herrera" },
  { filter: "collection", id: "2738", name: "Carrera Collection" },
  { filter: "collection", id: "17664", name: "CARRERA OPT WOMAN" },
  { filter: "collection", id: "17670", name: "CARRERA SUN" },
  { filter: "collection", id: "17667", name: "CARRERA SUN WOMAN" },
  { filter: "collection", id: "17405", name: "Carrera Ducati" },
  { filter: "collection", id: "16061", name: "Hugo Collection" },
  { filter: "collection", id: "12630", name: "Polaroid Core Collection" },
  { filter: "collection", id: "13300", name: "Polaroid Kids Collection" },
  { filter: "collection", id: "13301", name: "Polaroid Sport Collection" },
  { filter: "collection", id: "11521", name: "Tommy Hilfiger Collection" },
  { filter: "collection", id: "16970", name: "Under Armour Collection" },
  { filter: "collection", id: "15428", name: "Alexander McQueen" },
  { filter: "collection", id: "15426", name: "Bottega Veneta" },
  { filter: "collection", id: "15430", name: "Gucci" },
  { filter: "collection", id: "16337", name: "Montblanc" },
  { filter: "collection", id: "15427", name: "Saint Laurent" },
  { filter: "collection", id: "18106", name: "Valentino" },
  { filter: "collection", id: "9256", name: "DICAPRIO" },
  { filter: "collection", id: "6239", name: "FLEXURE" },
  { filter: "collection", id: "15091", name: "GRANDE" },
  { filter: "collection", id: "15373", name: "MILLENNIAL" },
  { filter: "collection", id: "15964", name: "SIMPLYLITE" },
  { filter: "brand", id: "4725", name: "Silhouette" },
]);

export function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

export function stripHtml(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function sectionById(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html).match(
    new RegExp(
      `<(?:div|section)\\b[^>]*\\bid=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/(?:div|section)>`,
      "i"
    )
  );
  return match?.[1] ?? "";
}

function attribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    String(tag).match(
      new RegExp(`\\b${escapedName}\\s*=\\s*["']([^"']*)["']`, "i")
    )?.[1] ?? null
  );
}

function tableRows(section) {
  return Array.from(String(section).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((row) =>
      Array.from(row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
        (cell) => stripHtml(cell[1])
      )
    )
    .filter((row) => row.length > 0);
}

function optionalNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value) {
  const parsed = optionalNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

function boundedInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function boundedMeasurement(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 120
    ? value
    : null;
}

function boundedText(value, maximum) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

export function sanitizeCatalogItemForImport(item) {
  return {
    ...item,
    providerItemId: String(item.providerItemId).trim().slice(0, 160),
    manufacturer: boundedText(item.manufacturer, 120),
    brand: String(item.brand).trim().slice(0, 100),
    collection: boundedText(item.collection, 120),
    model: String(item.model).trim().slice(0, 120),
    colorCode: boundedText(item.colorCode, 80),
    colorName: boundedText(item.colorName, 120),
    sku: boundedText(item.sku, 100),
    upc: boundedText(item.upc, 32),
    eyeSizeMm: boundedInteger(item.eyeSizeMm, 20, 80),
    bridgeSizeMm: boundedInteger(item.bridgeSizeMm, 5, 40),
    templeLengthMm: boundedInteger(item.templeLengthMm, 80, 180),
    aMeasurementMm: boundedMeasurement(item.aMeasurementMm),
    bMeasurementMm: boundedMeasurement(item.bMeasurementMm),
    effectiveDiameterMm: boundedMeasurement(item.effectiveDiameterMm),
    gender: boundedText(item.gender, 50),
    material: boundedText(item.material, 80),
    shape: boundedText(item.shape, 80),
    frameType: boundedText(item.frameType, 80),
    rimType: boundedText(item.rimType, 80),
    sourceStatus: boundedText(item.sourceStatus, 80),
  };
}

function imageCode(imagePath, fallback) {
  if (!imagePath) return fallback;
  const filename = imagePath.split("/").pop()?.split("?")[0] ?? "";
  return filename.replace(/\.[^.]+$/, "") || fallback;
}

function absoluteFramesDataUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, FRAMES_DATA_ORIGIN).toString();
  } catch {
    return null;
  }
}

export function highResolutionFrameImagePath(value) {
  if (!value) return value;
  return String(value).replace(
    /\/ColorSm\//i,
    "/Q120WEB/color_b/"
  );
}

function parseColors(html) {
  const imageTags = Array.from(
    String(html).matchAll(
      /<img\b[^>]*\bclass=["'][^"']*\bimg_detail_thumb\b[^"']*["'][^>]*>/gi
    )
  );

  const colors = imageTags.map((imageMatch, index) => {
    const start = imageMatch.index ?? 0;
    const end = imageTags[index + 1]?.index ?? start + 1200;
    const nearby = String(html).slice(start, end);
    const colorTag = nearby.match(
      /<(?:div|span)\b[^>]*\bclass=["'][^"']*\bImgThumbText\b[^"']*["'][^>]*>/i
    )?.[0];
    const src = attribute(imageMatch[0], "src");
    const titledColor = colorTag ? attribute(colorTag, "title") : null;
    const colorText = nearby.match(
      /<(?:div|span)\b[^>]*\bclass=["'][^"']*\bImgThumbText\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i
    )?.[1];

    return {
      colorName: stripHtml(titledColor || colorText || "") || null,
      imagePath: src,
    };
  });

  const seen = new Set();
  return colors.filter((color) => {
    const key = `${color.imagePath ?? ""}|${color.colorName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(color.imagePath || color.colorName);
  });
}

export function parseSearchFrameIds(html) {
  return Array.from(String(html).matchAll(/\bframeid=["'](\d+)["']/gi)).map(
    (match) => match[1]
  );
}

export function parseFrameDetails(
  html,
  frameId,
  collectionName = null,
  brandOverride = null
) {
  const titleSection = sectionById(html, "divFrmTtl");
  const titleLines = stripHtml(titleSection)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const styleLine = titleLines.find((line) => /^Style\s*:/i.test(line));
  const model = styleLine?.replace(/^Style\s*:\s*/i, "").trim();
  const styleIndex = styleLine ? titleLines.indexOf(styleLine) : -1;
  const manufacturer = titleLines[styleIndex + 1] || null;
  const sourceBrand = titleLines[styleIndex + 2] || manufacturer || null;
  const brand = brandOverride || sourceBrand;
  const normalizedCollection =
    collectionName ||
    (brandOverride && sourceBrand !== brandOverride ? sourceBrand : null);

  if (!model || !brand) {
    throw new Error(`Frame ${frameId} did not contain a recognizable style and brand.`);
  }

  const measurementRows = tableRows(sectionById(html, "divFrmEySz")).slice(1);
  const sizes =
    measurementRows.length > 0
      ? measurementRows.map((row) => ({
          eyeSizeMm: optionalInteger(row[0]),
          aMeasurementMm: optionalNumber(row[1]),
          bMeasurementMm: optionalNumber(row[2]),
          dblMm: optionalNumber(row[3]),
          effectiveDiameterMm: optionalNumber(row[4]),
          templeLengthMm: optionalInteger(row[5]),
          bridgeSizeMm: optionalInteger(row[6]),
          circumferenceMm: optionalNumber(row[7]),
        }))
      : [
          {
            eyeSizeMm: null,
            aMeasurementMm: null,
            bMeasurementMm: null,
            dblMm: null,
            effectiveDiameterMm: null,
            templeLengthMm: null,
            bridgeSizeMm: null,
            circumferenceMm: null,
          },
        ];

  const info = Object.fromEntries(
    tableRows(sectionById(html, "divFrmInfo"))
      .filter((row) => row.length >= 2 && row[0])
      .map((row) => [row[0].replace(/:\s*$/, ""), row[1] || null])
  );

  let colors = parseColors(html);
  if (colors.length === 0) {
    const mainImageTag = String(html).match(
      /<img\b[^>]*\bclass=["'][^"']*\bimg_detail_large\b[^"']*["'][^>]*>/i
    )?.[0];
    colors = [
      {
        colorName: null,
        imagePath: mainImageTag ? attribute(mainImageTag, "src") : null,
      },
    ];
  }

  return colors.flatMap((color, colorIndex) =>
    sizes.map((size, sizeIndex) => {
      const colorCode = imageCode(
        color.imagePath,
        `color-${String(colorIndex + 1).padStart(2, "0")}`
      );
      const sizeCode = [
        size.eyeSizeMm ?? "x",
        size.bridgeSizeMm ?? "x",
        size.templeLengthMm ?? "x",
      ].join("-");

      return {
        providerItemId: `${frameId}:${colorCode}:${sizeCode}:${sizeIndex + 1}`,
        manufacturer,
        brand,
        collection: normalizedCollection,
        model,
        colorCode,
        colorName: color.colorName,
        sku: null,
        upc: null,
        eyeSizeMm: size.eyeSizeMm,
        bridgeSizeMm: size.bridgeSizeMm,
        templeLengthMm: size.templeLengthMm,
        aMeasurementMm: size.aMeasurementMm,
        bMeasurementMm: size.bMeasurementMm,
        effectiveDiameterMm: size.effectiveDiameterMm,
        gender: info.Gender ?? null,
        material: info.Material ?? null,
        shape: info.Shape ?? null,
        frameType: info["Product Group"] ?? null,
        rimType: info.Rim ?? null,
        wholesalePriceCents: null,
        suggestedRetailPriceCents: null,
        imageUrl: absoluteFramesDataUrl(
          highResolutionFrameImagePath(color.imagePath)
        ),
        isActive: true,
        sourceStatus: "active",
        sourceUpdatedAt: null,
        rawData: {
          frameId,
          age: info.Age ?? null,
          bridgeType: info.Bridge ?? null,
          templeType: info.Temple ?? null,
          hinge: info.Hinge ?? null,
          case: info.Case ?? null,
          country: info.Country ?? null,
          introduced: info.Introduced ?? null,
          warranty: info.Warranty ?? null,
          catalogBrand: sourceBrand,
          dblMm: size.dblMm,
          circumferenceMm: size.circumferenceMm,
          source: "Frames Data Online licensed catalog",
        },
      };
    })
  );
}

export function splitSetCookieHeader(value) {
  if (!value) return [];
  return String(value).split(/,(?=\s*[^;,=\s]+=[^;,]+)/g);
}

class CookieJar {
  #cookies = new Map();

  capture(headers) {
    const values =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : splitSetCookieHeader(headers.get("set-cookie"));

    for (const value of values) {
      const pair = value.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      if (cookieValue) this.#cookies.set(name, cookieValue);
      else this.#cookies.delete(name);
    }
  }

  header() {
    return Array.from(this.#cookies, ([name, value]) => `${name}=${value}`).join(
      "; "
    );
  }
}

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

function parsePositiveInteger(value, fallback, label, maximum) {
  const parsed = value == null ? fallback : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum}.`);
  }
  return parsed;
}

function cliOptions(argv) {
  let limitWasExplicitlySet = false;
  const options = {
    dryRun: false,
    modernOptical: false,
    expandedCatalog: false,
    brand: process.env.FRAMES_DATA_SEARCH_TERM || "Modern",
    limit: parsePositiveInteger(
      process.env.FRAMES_DATA_SAMPLE_LIMIT,
      DEFAULT_LIMIT,
      "FRAMES_DATA_SAMPLE_LIMIT",
      1000
    ),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--modern-optical") {
      options.modernOptical = true;
    } else if (argument === "--expanded-catalog") {
      options.expandedCatalog = true;
    } else if (argument === "--brand") {
      options.brand = argv[++index]?.trim();
    } else if (argument === "--limit") {
      limitWasExplicitlySet = true;
      options.limit = parsePositiveInteger(
        argv[++index],
        DEFAULT_LIMIT,
        "--limit",
        1000
      );
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!options.modernOptical && !options.brand) {
    throw new Error("A brand search term is required.");
  }
  if (options.modernOptical && options.expandedCatalog) {
    throw new Error("Choose either --modern-optical or --expanded-catalog, not both.");
  }
  if (
    (options.modernOptical || options.expandedCatalog) &&
    !limitWasExplicitlySet
  ) {
    options.limit = null;
  }
  return options;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sessionRequest(jar, url, options = {}, attempts = 3) {
  let lastStatus = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const headers = new Headers(options.headers);
    const cookieHeader = jar.header();
    if (cookieHeader) headers.set("cookie", cookieHeader);
    headers.set(
      "user-agent",
      "LensWise licensed local integration proof-of-concept"
    );

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        redirect: "manual",
      });
    } catch {
      if (attempt === attempts) {
        throw new Error("The Frames Data request could not be completed.");
      }
      await sleep(500 * attempt);
      continue;
    }

    jar.capture(response.headers);
    lastStatus = response.status;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Frames Data returned an invalid redirect.");
      return sessionRequest(
        jar,
        new URL(location, url),
        { ...options, method: "GET", body: undefined },
        attempts
      );
    }

    if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
      await sleep(750 * attempt);
      continue;
    }

    return response;
  }

  throw new Error(`Frames Data returned status ${lastStatus ?? "unknown"}.`);
}

async function responseText(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}.`);
  }
  return response.text();
}

async function loginToFramesData(username, password) {
  const jar = new CookieJar();
  await responseText(
    await sessionRequest(jar, new URL("/fdol/", FRAMES_DATA_ORIGIN)),
    "Frames Data sign-in preparation"
  );

  const loginUrl = new URL("/GenericHandlers/FDAS.ashx", FRAMES_DATA_ORIGIN);
  loginUrl.searchParams.set("method", "FDOLLogin");
  loginUrl.searchParams.set("args[Username]", username);
  loginUrl.searchParams.set("args[Password]", password);

  let loginResponse;
  try {
    loginResponse = await sessionRequest(jar, loginUrl, {
      headers: {
        accept: "*/*",
        referer: `${FRAMES_DATA_ORIGIN}/fdol/`,
        "x-requested-with": "XMLHttpRequest",
      },
    });
  } catch {
    throw new Error("Frames Data sign-in could not be completed.");
  }

  const result = (await responseText(loginResponse, "Frames Data sign-in")).trim();
  if (result !== "SUCCESS") {
    throw new Error(
      "Frames Data rejected the sign-in. Check the local credentials and license access."
    );
  }

  await responseText(
    await sessionRequest(jar, new URL("/fdol/framesearch", FRAMES_DATA_ORIGIN)),
    "Frames Data catalog access"
  );
  return jar;
}

export function framesDataSearchUrl({
  username,
  keyword = "",
  collectionId = "",
  brandId = "",
  page = 1,
}) {
  const url = new URL("/GenericHandlers/FDOLSearch.ashx", FRAMES_DATA_ORIGIN);
  url.searchParams.set("method", "SearchFDOLHTML");
  for (const field of [
    "HasImage",
    "ProductGroupIDs",
    "ManufacturerIDs",
    "BrandIDs",
    "CollectionIDs",
    "Newest",
    "GenderIDs",
    "AgeIDs",
    "FrameShapeIDs",
    "MaterialIDs",
    "ColorIDs",
    "EyeSizeMin",
    "EyeSizeMax",
    "AMin",
    "AMax",
    "BMin",
    "BMax",
    "TempleMin",
    "TempleMax",
    "EDMin",
    "EDMax",
    "DBLMin",
    "DBLMax",
    "BridgeTypeID",
    "HingeID",
    "TempleTypeID",
    "ClipSunglassID",
    "RimIDs",
  ]) {
    url.searchParams.set(`args[Filter][${field}]`, "");
  }
  url.searchParams.set("args[Filter][CollectionIDs]", collectionId);
  url.searchParams.set("args[Filter][BrandIDs]", brandId);
  url.searchParams.set("args[Filter][FeaturedBrands][IDs]", "");
  url.searchParams.set("args[Filter][FeaturedBrands][FTypes]", "");
  url.searchParams.set("args[Filter][Keyword]", keyword);
  url.searchParams.set("args[Filter][Term]", keyword ? "B" : "");
  url.searchParams.set("args[Filter][ClientID]", username);
  url.searchParams.set("args[Filter][Page]", String(page));
  url.searchParams.set("args[Filter][NumRecs]", String(SEARCH_PAGE_SIZE));
  url.searchParams.set("args[Filter][OrderBy]", "BRANDS_ASC");
  url.searchParams.set("args[Filter][LandingSearch]", "");
  return url;
}

async function searchFrameIds(
  jar,
  username,
  { keyword = "", collectionId = "", brandId = "", limit = null, label }
) {
  const ids = [];
  const seen = new Set();
  const maxPages = limit
    ? Math.ceil(limit / SEARCH_PAGE_SIZE) + 2
    : MAX_SEARCH_PAGES;

  for (
    let page = 1;
    page <= maxPages && (limit == null || ids.length < limit);
    page += 1
  ) {
    const url = framesDataSearchUrl({
      username,
      keyword,
      collectionId,
      brandId,
      page,
    });

    const response = await sessionRequest(jar, url, {
      headers: {
        accept: "text/html, */*; q=0.01",
        referer: `${FRAMES_DATA_ORIGIN}/fdol/framesearch`,
        "x-requested-with": "XMLHttpRequest",
      },
    });
    const html = await responseText(response, "Frames Data catalog search");
    const pageIds = parseSearchFrameIds(html);

    if (
      /Frames Data Login Page|id=["']login_panel["']|id=["']txtLoginPassword["']/i.test(
        html
      )
    ) {
      throw new Error(
        "Frames Data accepted the credentials but did not preserve the authenticated catalog session."
      );
    }

    for (const id of pageIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (limit != null && ids.length >= limit) break;
    }

    if (pageIds.length === 0) {
      if (page === 1) {
        throw new Error(`Frames Data returned no catalog records for ${label}.`);
      }
      break;
    }
  }

  if (limit == null && ids.length >= MAX_SEARCH_PAGES * SEARCH_PAGE_SIZE) {
    throw new Error(`Frames Data search for ${label} exceeded the safety limit.`);
  }

  return ids;
}

async function fetchFrameDetails(jar, username, frameId) {
  const url = new URL("/GenericHandlers/FDOLSearch.ashx", FRAMES_DATA_ORIGIN);
  url.searchParams.set("method", "GetFrameDetails");
  url.searchParams.set("args[FrameId]", frameId);
  url.searchParams.set("args[Featured]", "false");
  url.searchParams.set("args[Username]", username);

  const response = await sessionRequest(jar, url, {
    headers: {
      accept: "text/html, */*; q=0.01",
      referer: `${FRAMES_DATA_ORIGIN}/fdol/framesearch`,
      "x-requested-with": "XMLHttpRequest",
    },
  });
  return responseText(response, `Frames Data frame ${frameId}`);
}

async function lensWiseRequest(importUrl, secret, body) {
  let response;
  try {
    response = await fetch(importUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "LensWise could not be reached. Start the local app and check FRAMES_DATA_IMPORT_URL."
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const issueSummary = Array.isArray(payload?.issues)
      ? payload.issues
          .slice(0, 5)
          .map((issue) => `${issue.path || "payload"}: ${issue.message}`)
          .join("; ")
      : "";
    throw new Error(
      [
        payload?.error || `LensWise import failed (${response.status}).`,
        issueSummary,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  return payload;
}

function saveImportCache(items, sourceLabel) {
  const cacheDirectory = path.resolve(process.cwd(), IMPORT_CACHE_DIRECTORY);
  fs.mkdirSync(cacheDirectory, { recursive: true });
  const safeLabel = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cachePath = path.join(cacheDirectory, `${safeLabel}.json`);
  fs.writeFileSync(
    cachePath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceLabel,
        items,
      },
      null,
      2
    ),
    "utf8"
  );
  return cachePath;
}

async function importIntoLensWise(importUrl, secret, items, sourceLabel) {
  const started = await lensWiseRequest(importUrl, secret, {
    operation: "start",
    mode: "incremental",
    sourceCursor: `licensed-web-poc:${sourceLabel}:${new Date().toISOString()}`,
  });
  const runId = started?.runId;
  if (!runId) throw new Error("LensWise did not return an import run ID.");

  try {
    for (let index = 0; index < items.length; index += IMPORT_BATCH_SIZE) {
      await lensWiseRequest(importUrl, secret, {
        operation: "batch",
        runId,
        items: items.slice(index, index + IMPORT_BATCH_SIZE),
      });
    }
    return await lensWiseRequest(importUrl, secret, {
      operation: "finish",
      runId,
    });
  } catch (error) {
    await lensWiseRequest(importUrl, secret, {
      operation: "fail",
      runId,
      error: "Licensed local catalog proof-of-concept import failed.",
    }).catch(() => {});
    throw error;
  }
}

async function main() {
  loadLocalEnvironment();
  const options = cliOptions(process.argv.slice(2));
  const username = process.env.FRAMES_DATA_USERNAME?.trim();
  const password = process.env.FRAMES_DATA_PASSWORD;
  const delayMs = parsePositiveInteger(
    process.env.FRAMES_DATA_REQUEST_DELAY_MS,
    DEFAULT_DELAY_MS,
    "FRAMES_DATA_REQUEST_DELAY_MS",
    10_000
  );

  if (!username || !password) {
    throw new Error(
      "Set FRAMES_DATA_USERNAME and FRAMES_DATA_PASSWORD in .env.local."
    );
  }

  const sourceLabel = options.modernOptical
    ? "modern-optical-selected-collections"
    : options.expandedCatalog
      ? "expanded-office-catalog"
    : options.brand;
  console.log(
    `Connecting to the licensed Frames Data catalog for "${sourceLabel}"…`
  );
  const jar = await loginToFramesData(username, password);
  const frameTargets = new Map();

  if (options.modernOptical || options.expandedCatalog) {
    const targets = options.modernOptical
      ? MODERN_OPTICAL_COLLECTIONS.map((collection) => ({
          ...collection,
          filter: "collection",
        }))
      : EXPANDED_CATALOG_TARGETS;
    for (const target of targets) {
      const collectionIds = await searchFrameIds(jar, username, {
        collectionId: target.filter === "collection" ? target.id : "",
        brandId: target.filter === "brand" ? target.id : "",
        limit: options.limit,
        label: `${target.filter} "${target.name}"`,
      });
      for (const frameId of collectionIds) {
        if (!frameTargets.has(frameId)) {
          frameTargets.set(frameId, {
            collectionName:
              target.filter === "collection" ? target.name : null,
            brandName: target.filter === "brand" ? target.name : null,
          });
        }
      }
      console.log(
        `${target.name}: found ${collectionIds.length} frame styles.`
      );
    }
  } else {
    const brandIds = await searchFrameIds(jar, username, {
      keyword: options.brand,
      limit: options.limit,
      label: `brand search "${options.brand}"`,
    });
    for (const frameId of brandIds) {
      frameTargets.set(frameId, {
        collectionName: null,
        brandName: null,
      });
    }
  }

  console.log(
    `Found ${frameTargets.size} unique frame styles. Reading details…`
  );

  const items = [];
  const targets = Array.from(frameTargets);
  for (let index = 0; index < targets.length; index += 1) {
    const [frameId, target] = targets[index];
    const html = await fetchFrameDetails(jar, username, frameId);
    items.push(
      ...parseFrameDetails(
        html,
        frameId,
        target.collectionName,
        target.brandName
      ).map(sanitizeCatalogItemForImport)
    );
    if ((index + 1) % 10 === 0 || index + 1 === targets.length) {
      console.log(`Read ${index + 1}/${targets.length} frame styles.`);
    }
    if (index + 1 < targets.length) await sleep(delayMs);
  }

  if (items.length === 0) {
    throw new Error("No normalized frame variants were produced.");
  }

  if (options.dryRun) {
    console.log(
      `Dry run complete: ${items.length} color/size variants from ${targets.length} styles.`
    );
    console.log(
      JSON.stringify(
        items.slice(0, 3).map(({ rawData: _rawData, ...item }) => item),
        null,
        2
      )
    );
    return;
  }

  const cachePath = saveImportCache(items, sourceLabel);
  console.log(`Saved a retry cache at ${cachePath}.`);

  const secret = process.env.FRAMES_DATA_IMPORT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Set FRAMES_DATA_IMPORT_SECRET (at least 32 characters) in .env.local."
    );
  }
  const importUrl = process.env.FRAMES_DATA_IMPORT_URL || DEFAULT_IMPORT_URL;
  const result = await importIntoLensWise(
    importUrl,
    secret,
    items,
    sourceLabel
  );
  console.log(
    `Import complete: ${items.length} variants from ${targets.length} frame styles.`
  );
  if (result?.status) console.log(`LensWise import status: ${result.status}.`);
}

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Import failed.");
    process.exitCode = 1;
  });
}
