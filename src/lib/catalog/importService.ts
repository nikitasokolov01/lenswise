import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  FRAMES_DATA_PROVIDER,
  framesDataCatalogRow,
  type FramesDataCatalogItem,
} from "@/lib/catalog/framesData";

interface ImportRunRow {
  id: string;
  provider: string;
  mode: "full" | "incremental";
  status: "running" | "completed" | "failed";
  records_received: number;
  records_upserted: number;
}

async function requireRunningImport(runId: string): Promise<ImportRunRow> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("catalog_import_runs")
    .select("id,provider,mode,status,records_received,records_upserted")
    .eq("id", runId)
    .eq("provider", FRAMES_DATA_PROVIDER)
    .single();

  if (error || !data) throw new Error("Frames Data import run was not found.");
  if (data.status !== "running") throw new Error("Frames Data import run is no longer active.");
  return data as ImportRunRow;
}

export async function startFramesDataImport(input: {
  mode: "full" | "incremental";
  sourceCursor?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("catalog_import_runs")
    .insert({
      provider: FRAMES_DATA_PROVIDER,
      mode: input.mode,
      source_cursor: input.sourceCursor ?? null,
      status: "running",
    })
    .select("id,started_at")
    .single();

  if (error || !data) throw new Error("Could not start the Frames Data import.");
  return { runId: data.id as string, startedAt: data.started_at as string };
}

export async function importFramesDataBatch(runId: string, items: FramesDataCatalogItem[]) {
  const run = await requireRunningImport(runId);
  const admin = createSupabaseAdminClient();
  const rows = items.map((item) => framesDataCatalogRow(item, runId));

  const { error: upsertError } = await admin
    .from("frame_catalog_items")
    .upsert(rows, { onConflict: "provider,provider_item_id" });
  if (upsertError) throw new Error("Could not save the Frames Data batch.");

  const recordsReceived = run.records_received + items.length;
  const recordsUpserted = run.records_upserted + items.length;
  const { error: runError } = await admin
    .from("catalog_import_runs")
    .update({
      records_received: recordsReceived,
      records_upserted: recordsUpserted,
    })
    .eq("id", runId)
    .eq("status", "running");
  if (runError) throw new Error("The import batch was saved, but its progress could not be recorded.");

  return { runId, received: items.length, recordsReceived, recordsUpserted };
}

export async function finishFramesDataImport(runId: string) {
  const run = await requireRunningImport(runId);
  const admin = createSupabaseAdminClient();
  let deactivated = 0;
  const completedAt = new Date().toISOString();

  if (run.mode === "full") {
    const inactiveValues = {
      is_active: false,
      source_status: "not_present_in_latest_full_import",
      discontinued_at: completedAt,
    };

    const { count: neverSeenCount, error: neverSeenError } = await admin
      .from("frame_catalog_items")
      .update(inactiveValues, { count: "exact" })
      .eq("provider", FRAMES_DATA_PROVIDER)
      .eq("is_active", true)
      .is("last_seen_import_run_id", null);
    if (neverSeenError) throw new Error("Could not finalize missing catalog items.");

    const { count: previousRunCount, error: previousRunError } = await admin
      .from("frame_catalog_items")
      .update(inactiveValues, { count: "exact" })
      .eq("provider", FRAMES_DATA_PROVIDER)
      .eq("is_active", true)
      .not("last_seen_import_run_id", "eq", runId);
    if (previousRunError) throw new Error("Could not finalize stale catalog items.");

    deactivated = (neverSeenCount ?? 0) + (previousRunCount ?? 0);
  }

  const { error: runError } = await admin
    .from("catalog_import_runs")
    .update({
      status: "completed",
      records_deactivated: deactivated,
      completed_at: completedAt,
    })
    .eq("id", runId)
    .eq("status", "running");
  if (runError) throw new Error("Could not complete the Frames Data import.");

  const { error: connectionError } = await admin
    .from("organization_catalog_connections")
    .update({ last_synced_at: completedAt })
    .eq("provider", FRAMES_DATA_PROVIDER)
    .eq("status", "active");
  if (connectionError) throw new Error("The catalog imported, but connection status could not be updated.");

  return {
    runId,
    status: "completed" as const,
    recordsReceived: run.records_received,
    recordsUpserted: run.records_upserted,
    recordsDeactivated: deactivated,
    completedAt,
  };
}

export async function failFramesDataImport(runId: string, errorSummary: string) {
  const admin = createSupabaseAdminClient();
  const completedAt = new Date().toISOString();
  const { error } = await admin
    .from("catalog_import_runs")
    .update({
      status: "failed",
      error_summary: errorSummary,
      completed_at: completedAt,
    })
    .eq("id", runId)
    .eq("provider", FRAMES_DATA_PROVIDER)
    .eq("status", "running");

  if (error) throw new Error("Could not mark the Frames Data import as failed.");
  return { runId, status: "failed" as const, completedAt };
}

export async function setFramesDataConnection(input: {
  organizationId: string;
  status: "pending" | "active" | "suspended" | "disabled";
  externalAccountRef?: string | null;
  licensedLocations?: number;
  updatedBy?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_catalog_connections")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: FRAMES_DATA_PROVIDER,
        status: input.status,
        external_account_ref: input.externalAccountRef ?? null,
        licensed_locations: input.licensedLocations ?? 1,
        created_by: input.updatedBy ?? null,
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: "organization_id,provider" }
    )
    .select("id,organization_id,provider,status,last_synced_at")
    .single();

  if (error || !data) throw new Error("Could not update the Frames Data connection.");
  return data;
}
