import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

function assertEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getArg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function parsePageSize() {
  const raw = getArg("--page-size", process.env.PAGE_SIZE ?? "1000") ?? "1000";
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid page size: ${raw}`);
  }
  return value;
}

function parseEqFilters() {
  const raw = getArg("--eq", process.env.SUPABASE_EQ_FILTERS ?? "")?.trim();
  if (!raw) return [] as Array<{ column: string; value: string }>;

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
        throw new Error(`Invalid filter "${entry}". Use column=value.`);
      }

      return {
        column: entry.slice(0, separatorIndex).trim(),
        value: entry.slice(separatorIndex + 1).trim(),
      };
    });
}

function normalizeFilterValue(value: string): boolean | number | string {
  if (value === "true") return true;
  if (value === "false") return false;

  const numericValue = Number(value);
  if (value.length > 0 && Number.isFinite(numericValue) && `${numericValue}` === value) {
    return numericValue;
  }

  return value;
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

async function main() {
  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tableName = getArg("--table", process.env.SUPABASE_TABLE ?? "deals")?.trim();

  if (!tableName) {
    throw new Error("Table name is required. Use --table or SUPABASE_TABLE.");
  }

  const outputPath = path.resolve(
    process.cwd(),
    getArg("--output", process.env.OUTPUT_CSV ?? `${tableName}.csv`) ?? `${tableName}.csv`,
  );
  const pageSize = parsePageSize();
  const eqFilters = parseEqFilters();

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const allRows: Row[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(tableName).select("*").range(offset, offset + pageSize - 1);

    for (const filter of eqFilters) {
      query = query.eq(filter.column, normalizeFilterValue(filter.value));
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed loading ${tableName}: ${error.message}`);
    }

    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    allRows.push(...rows);
    offset += pageSize;
  }

  if (allRows.length === 0) {
    await writeFile(outputPath, "", "utf8");
    console.log(`[export] no rows found in "${tableName}" -> ${outputPath}`);
    return;
  }

  const headers = Array.from(new Set(allRows.flatMap((row) => Object.keys(row)))).sort();
  const lines = [
    headers.map(escapeCsv).join(","),
    ...allRows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`[export] wrote ${allRows.length} rows from "${tableName}" -> ${outputPath}`);
}

main().catch((error) => {
  console.error("[export] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
