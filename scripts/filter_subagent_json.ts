import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SubagentRecord = {
  name?: unknown;
  api?: unknown;
  api_key?: unknown;
};

function getArg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  return fallback;
}

function toFilteredRecord(entry: SubagentRecord) {
  return {
    name: typeof entry.name === "string" ? entry.name : "",
    api: typeof entry.api_key === "string" ? entry.api_key : typeof entry.api === "string" ? entry.api : "",
  };
}

async function main() {
  const inputPath = path.resolve(
    process.cwd(),
    getArg("--input", "subagent.json") ?? "subagent.json",
  );
  const outputPath = path.resolve(
    process.cwd(),
    getArg("--output", "subagent.filtered.json") ?? "subagent.filtered.json",
  );

  console.log(`[subagent-filter] reading ${inputPath}`);
  const raw = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Expected top-level JSON array in input file");
  }

  const filtered = parsed.map((entry) => toFilteredRecord((entry ?? {}) as SubagentRecord));

  await writeFile(outputPath, `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
  console.log(`[subagent-filter] wrote ${filtered.length} records -> ${outputPath}`);
}

main().catch((error) => {
  console.error("[subagent-filter] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
