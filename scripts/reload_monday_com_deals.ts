import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDealCategoryAndTagFromGhlStage } from "../src/lib/monday-deal-category-tags";
import { readCsvFile } from "../src/lib/monday-deals/csv";
import {
  CSV_REQUIRED_HEADERS,
  DEAL_FIELD_KEYS,
  type DealFields,
  extractDealFieldsFromCsvRow,
} from "../src/lib/monday-deals/extract";
const TABLE_NAME = "monday_com_deals";
const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_INSERT_BATCH_SIZE = 500;

const PRESERVED_FIELD_KEYS = [
  "created_at",
  "updated_at",
  "disposition",
  "disposition_date",
  "disposition_agent_id",
  "disposition_agent_name",
  "disposition_notes",
  "callback_datetime",
  "disposition_count",
] as const;

type PreservedFieldKey = (typeof PRESERVED_FIELD_KEYS)[number];
type BackupRow = Record<string, unknown>;
type ReloadRow = DealFields & Partial<Record<PreservedFieldKey, unknown>>;
type SourceCsvRow = Record<string, string>;
type ImportedSourceRow = {
  deal: DealFields;
  sourceRow: SourceCsvRow;
};

const PRESERVED_TIMESTAMP_KEYS = new Set<PreservedFieldKey>([
  "created_at",
  "updated_at",
  "disposition_date",
  "callback_datetime",
]);
const PRESERVED_NUMBER_KEYS = new Set<PreservedFieldKey>(["disposition_count"]);

const NUMBER_FIELDS = new Set<keyof DealFields>(["deal_value", "cc_value"]);
const DATE_FIELDS = new Set<keyof DealFields>([
  "deal_creation_date",
  "last_updated",
  "effective_date",
  "lead_creation_date",
]);

function assertEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getArg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  return fallback;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function parseIntegerArg(name: string, fallback: string, min?: number, max?: number) {
  const raw = getArg(name, fallback) ?? fallback;
  const value = Number.parseInt(raw, 10);

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  if (min != null && value < min) {
    throw new Error(`${name} must be >= ${min}`);
  }
  if (max != null && value > max) {
    throw new Error(`${name} must be <= ${max}`);
  }

  return value;
}

function getTimestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";

  const text =
    typeof value === "object"
      ? JSON.stringify(value)
      : typeof value === "string"
        ? value
        : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

async function fetchAllTableRows(
  supabase: SupabaseClient,
  tableName: string,
) {
  const rows: BackupRow[] = [];
  let offset = 0;

  while (true) {
    console.log(`[reload] reading ${tableName} rows offset=${offset}`);
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed reading ${tableName}: ${error.message}`);
    }

    const pageRows = (data ?? []) as BackupRow[];
    if (pageRows.length === 0) break;

    rows.push(...pageRows);
    offset += SUPABASE_PAGE_SIZE;
    console.log(`[reload] read ${pageRows.length} rows, total=${rows.length}`);
  }

  return rows;
}

async function writeRowsToCsv(rows: BackupRow[], outputPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });

  if (rows.length === 0) {
    await writeFile(outputPath, "", "utf8");
    console.log(`[reload] wrote empty backup csv -> ${outputPath}`);
    return;
  }

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).sort();
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`[reload] wrote backup csv rows=${rows.length} -> ${outputPath}`);
}

function getTextValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildTimestampFallback(sourceRow: SourceCsvRow) {
  const now = new Date().toISOString();
  const sourceCreatedAt = getTextValue(sourceRow.created_at);
  const sourceUpdatedAt = getTextValue(sourceRow.updated_at);

  return {
    created_at: sourceCreatedAt ?? now,
    updated_at: sourceUpdatedAt ?? sourceCreatedAt ?? now,
  };
}

function normalizePreservedValue(
  key: PreservedFieldKey,
  value: unknown,
  timestampFallback: { created_at: string; updated_at: string },
) {
  if (key === "created_at") {
    return getTextValue(value) ?? timestampFallback.created_at;
  }

  if (key === "updated_at") {
    return getTextValue(value) ?? timestampFallback.updated_at;
  }

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return PRESERVED_TIMESTAMP_KEYS.has(key) ? null : null;
    }

    if (PRESERVED_NUMBER_KEYS.has(key)) {
      const numericValue = Number(trimmed);
      return Number.isFinite(numericValue) ? numericValue : null;
    }

    return trimmed;
  }

  if (PRESERVED_NUMBER_KEYS.has(key) && typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return value;
}

function getPreservedFields(row: BackupRow | undefined, sourceRow: SourceCsvRow) {
  const preserved: Partial<Record<PreservedFieldKey, unknown>> = {};
  const timestampFallback = buildTimestampFallback(sourceRow);

  if (!row) {
    preserved.created_at = timestampFallback.created_at;
    preserved.updated_at = timestampFallback.updated_at;
    return preserved;
  }

  for (const key of PRESERVED_FIELD_KEYS) {
    const value = row[key];
    if (Object.prototype.hasOwnProperty.call(row, key) && value !== undefined) {
      preserved[key] = normalizePreservedValue(key, value, timestampFallback);
    }
  }

  preserved.created_at ??= timestampFallback.created_at;
  preserved.updated_at ??= timestampFallback.updated_at;
  return preserved;
}

function buildReloadRows(
  importedRows: ImportedSourceRow[],
  existingRowsByMondayItemId: Map<string, BackupRow>,
) {
  return importedRows.map(({ deal, sourceRow }) => ({
    ...deal,
    ...getPreservedFields(existingRowsByMondayItemId.get(deal.monday_item_id), sourceRow),
  })) as ReloadRow[];
}

function findDuplicateMondayItemIds(rows: DealFields[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.monday_item_id)) {
      duplicates.add(row.monday_item_id);
      continue;
    }
    seen.add(row.monday_item_id);
  }

  return [...duplicates];
}

function normalizeComparison(field: keyof DealFields, value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (NUMBER_FIELDS.has(field)) {
    if (typeof value === "number") return value;
    const numericValue = Number(String(value).replace(/[^0-9.+-]/g, "").trim());
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (DATE_FIELDS.has(field)) {
    const text = String(value).trim();
    return text ? text.slice(0, 10) : null;
  }

  return typeof value === "string" ? value.trim() : String(value);
}

async function validateReload(
  supabase: SupabaseClient,
  sourceRows: DealFields[],
) {
  console.log("[reload] starting validation");

  const importedById = new Map(sourceRows.map((row) => [row.monday_item_id, row]));
  const dbRows = await fetchAllTableRows(supabase, TABLE_NAME);
  const dbById = new Map(
    dbRows.map((row) => [String(row.monday_item_id ?? ""), row]),
  );

  const mismatches: string[] = [];

  if (dbRows.length !== sourceRows.length) {
    mismatches.push(`row count mismatch source=${sourceRows.length} db=${dbRows.length}`);
  }

  for (const row of sourceRows) {
    const dbRow = dbById.get(row.monday_item_id);
    if (!dbRow) {
      mismatches.push(`missing db row for monday_item_id=${row.monday_item_id}`);
      if (mismatches.length >= 20) break;
      continue;
    }

    for (const field of DEAL_FIELD_KEYS) {
      const sourceValue = normalizeComparison(field, row[field]);
      const dbValue = normalizeComparison(field, dbRow[field]);
      if (sourceValue !== dbValue) {
        mismatches.push(
          `field mismatch monday_item_id=${row.monday_item_id} field=${field} source=${JSON.stringify(sourceValue)} db=${JSON.stringify(dbValue)}`,
        );
        break;
      }
    }

    if (mismatches.length >= 20) break;
  }

  const extraIds = [...dbById.keys()].filter((mondayItemId) => !importedById.has(mondayItemId));
  for (const mondayItemId of extraIds.slice(0, 20 - mismatches.length)) {
    mismatches.push(`unexpected db row monday_item_id=${mondayItemId}`);
  }

  const unknownStages = new Map<string, number>();
  for (const row of sourceRows) {
    if (!row.ghl_stage) continue;
    if (getDealCategoryAndTagFromGhlStage(row.ghl_stage)) continue;
    unknownStages.set(row.ghl_stage, (unknownStages.get(row.ghl_stage) ?? 0) + 1);
  }

  if (mismatches.length > 0) {
    console.error("[reload] validation mismatches detected:");
    for (const mismatch of mismatches) {
      console.error(`  - ${mismatch}`);
    }
    throw new Error("Validation failed after reload");
  }

  console.log(`[reload] validation passed for ${sourceRows.length} rows`);
  if (unknownStages.size > 0) {
    console.log("[reload] ghl_stage values without category mapping:");
    for (const [stage, count] of [...unknownStages.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${stage}: ${count}`);
    }
  } else {
    console.log("[reload] all ghl_stage values mapped by STAGE_TO_MAPPING");
  }
}

async function main() {
  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  const insertBatchSize = parseIntegerArg(
    "--batch-size",
    String(DEFAULT_INSERT_BATCH_SIZE),
    1,
    1000,
  );
  const inputCsv = path.resolve(
    process.cwd(),
    getArg("--input-csv", "monday_board_18027763264.csv") ?? "monday_board_18027763264.csv",
  );
  const preserveFromBackupCsv = getArg("--preserve-from-backup-csv");
  const skipBackup = hasArg("--skip-backup");
  const backupOutput = path.resolve(
    process.cwd(),
    getArg("--backup-output", `${TABLE_NAME}.backup.${getTimestampLabel()}.csv`) ??
      `${TABLE_NAME}.backup.${getTimestampLabel()}.csv`,
  );
  const confirmDelete = hasArg("--confirm-delete-live-table");

  console.log("[reload] starting monday_com_deals reload", {
    inputCsv,
    preserveFromBackupCsv: preserveFromBackupCsv
      ? path.resolve(process.cwd(), preserveFromBackupCsv)
      : null,
    skipBackup,
    insertBatchSize,
    backupOutput,
    confirmDelete,
  });

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const shouldReadLiveRows = !skipBackup || !preserveFromBackupCsv;
  const existingRows = shouldReadLiveRows ? await fetchAllTableRows(supabase, TABLE_NAME) : [];

  if (skipBackup) {
    console.log("[reload] skipping fresh backup creation");
  } else {
    await writeRowsToCsv(existingRows, backupOutput);
  }

  const preservationRows = preserveFromBackupCsv
    ? (await readCsvFile(path.resolve(process.cwd(), preserveFromBackupCsv))).rows
    : existingRows;
  if (preserveFromBackupCsv) {
    console.log(
      `[reload] loaded preservation source rows=${preservationRows.length} from backup csv ${path.resolve(process.cwd(), preserveFromBackupCsv)}`,
    );
  }

  const existingRowsByMondayItemId = new Map<string, BackupRow>();
  for (const row of preservationRows) {
    const mondayItemId = typeof row.monday_item_id === "string" ? row.monday_item_id : String(row.monday_item_id ?? "");
    if (!mondayItemId) continue;
    existingRowsByMondayItemId.set(mondayItemId, row);
  }
  console.log(
    `[reload] existing live rows=${existingRows.length} preservationRows=${preservationRows.length} rowsWithMondayItemId=${existingRowsByMondayItemId.size}`,
  );

  console.log(`[reload] reading source csv ${inputCsv}`);
  const { headers, rows } = await readCsvFile(inputCsv);
  const missingHeaders = CSV_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Input CSV is missing required headers: ${missingHeaders.join(", ")}`);
  }
  console.log(`[reload] parsed source csv headers=${headers.length} rows=${rows.length}`);

  const importedRows = rows.map((row) => ({
    deal: extractDealFieldsFromCsvRow(row),
    sourceRow: row,
  }));
  const duplicateMondayItemIds = findDuplicateMondayItemIds(importedRows.map((row) => row.deal));
  if (duplicateMondayItemIds.length > 0) {
    throw new Error(
      `Duplicate monday item ids found in source data: ${duplicateMondayItemIds.slice(0, 10).join(", ")}`,
    );
  }

  if (importedRows.length === 0) {
    throw new Error("No source rows were parsed from CSV. Aborting before touching live data.");
  }

  const reloadRows = buildReloadRows(importedRows, existingRowsByMondayItemId);
  const restoredFieldCount = reloadRows.filter((row) =>
    PRESERVED_FIELD_KEYS.some((key) => row[key] !== undefined),
  ).length;
  console.log(
    `[reload] prepared reload payload rows=${reloadRows.length} rowsWithPreservedFields=${restoredFieldCount}`,
  );

  if (!confirmDelete) {
    console.log("[reload] backup completed and source payload prepared");
    throw new Error(
      "Refusing to delete live data without --confirm-delete-live-table. Re-run with that flag after reviewing the backup CSV.",
    );
  }

  console.log(`[reload] deleting existing ${TABLE_NAME} rows`);
  const { error: deleteError } = await supabase
    .from(TABLE_NAME)
    .delete({ count: "exact" })
    .not("id", "is", null);

  if (deleteError) {
    throw new Error(`Failed deleting ${TABLE_NAME}: ${deleteError.message}`);
  }
  console.log(`[reload] deleted existing ${TABLE_NAME} rows`);

  for (let index = 0; index < reloadRows.length; index += insertBatchSize) {
    const batch = reloadRows.slice(index, index + insertBatchSize);
    console.log(
      `[reload] inserting batch ${Math.floor(index / insertBatchSize) + 1} size=${batch.length}`,
    );

    const { error } = await supabase.from(TABLE_NAME).insert(batch);
    if (error) {
      throw new Error(`Failed inserting batch starting at index ${index}: ${error.message}`);
    }

    console.log(
      `[reload] inserted ${Math.min(index + batch.length, reloadRows.length)}/${reloadRows.length} rows`,
    );
  }

  await validateReload(
    supabase,
    importedRows.map((row) => row.deal),
  );
  console.log(`[reload] completed successfully backup=${backupOutput}`);
}

main().catch((error) => {
  console.error("[reload] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
