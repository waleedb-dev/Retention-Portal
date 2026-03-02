import "dotenv/config";
import path from "node:path";
import { getDealCategoryAndTagFromGhlStage } from "../src/lib/monday-deal-category-tags";
import { readCsvFile } from "../src/lib/monday-deals/csv";
import {
  CSV_REQUIRED_HEADERS,
  extractDealFieldsFromCsvRow,
} from "../src/lib/monday-deals/extract";

function getArg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  return fallback;
}

async function main() {
  const inputCsv = path.resolve(
    process.cwd(),
    getArg("--input-csv", "monday_board_18027763264.csv") ?? "monday_board_18027763264.csv",
  );

  console.log(`[monday-csv-test] reading ${inputCsv}`);
  const { headers, rows } = await readCsvFile(inputCsv);
  console.log(`[monday-csv-test] headers=${headers.length} rows=${rows.length}`);

  const missingHeaders = CSV_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV headers: ${missingHeaders.join(", ")}`);
  }

  if (rows.length === 0) {
    throw new Error("CSV contains no data rows");
  }

  const duplicates = new Set<string>();
  const seen = new Set<string>();
  const unmappedStages = new Map<string, number>();

  for (const row of rows) {
    const mapped = extractDealFieldsFromCsvRow(row);

    if (!mapped.monday_item_id) {
      throw new Error("Found row with empty monday_item_id");
    }

    if (seen.has(mapped.monday_item_id)) {
      duplicates.add(mapped.monday_item_id);
    } else {
      seen.add(mapped.monday_item_id);
    }

    if (mapped.ghl_stage && !getDealCategoryAndTagFromGhlStage(mapped.ghl_stage)) {
      unmappedStages.set(mapped.ghl_stage, (unmappedStages.get(mapped.ghl_stage) ?? 0) + 1);
    }
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate monday_item_id values found: ${[...duplicates].slice(0, 20).join(", ")}`);
  }

  const samples = rows.slice(0, 3).map((row) => extractDealFieldsFromCsvRow(row));
  console.log("[monday-csv-test] sample mapped rows");
  for (const sample of samples) {
    console.log(sample);
  }

  if (unmappedStages.size > 0) {
    console.log("[monday-csv-test] unmapped ghl_stage values");
    for (const [stage, count] of [...unmappedStages.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${stage}: ${count}`);
    }
  } else {
    console.log("[monday-csv-test] all ghl_stage values map via STAGE_TO_MAPPING");
  }

  console.log(`[monday-csv-test] validation passed for ${rows.length} rows`);
}

main().catch((error) => {
  console.error("[monday-csv-test] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
