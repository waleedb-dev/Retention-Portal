import "dotenv/config";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";

const MONDAY_API_URL = "https://api.monday.com/v2";

type MondayColumn = {
  id: string;
  title: string;
  type: string | null;
};

type MondayBoard = {
  id: string;
  name: string;
  columns?: MondayColumn[];
  items_page?: {
    cursor?: string | null;
    items?: MondayItem[];
  };
};

type MondayColumnValue = {
  id: string;
  type: string | null;
  text: string | null;
  value: string | null;
};

type MondayItem = {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  group?: {
    id: string;
    title: string;
    color: string | null;
  } | null;
  column_values?: MondayColumnValue[];
};

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

function parseBoardId() {
  const raw = getArg("--board-id", process.env.MONDAY_BOARD_ID)?.trim();
  if (!raw) throw new Error("MONDAY_BOARD_ID or --board-id is required");

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new Error(`Invalid board id: ${raw}`);
  return value;
}

function parsePageLimit() {
  const raw = getArg("--page-limit", process.env.PAGE_LIMIT ?? "100") ?? "100";
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1 || value > 500) {
    throw new Error(`Invalid page limit: ${raw}. Expected 1..500.`);
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

async function gql<T>(token: string, query: string, variables?: Record<string, unknown>) {
  console.log("[monday-export] sending GraphQL request", {
    hasCursor: typeof variables?.cursor === "string",
  });

  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const bodyText = await response.text();
  console.log("[monday-export] received GraphQL response", {
    status: response.status,
    bytes: bodyText.length,
  });

  if (!response.ok) {
    throw new Error(`Monday API request failed (${response.status}): ${bodyText}`);
  }

  const body = JSON.parse(bodyText) as {
    data?: T;
    errors?: unknown;
  };

  if (body.errors) {
    throw new Error(`Monday GraphQL errors: ${JSON.stringify(body.errors)}`);
  }

  if (!body.data) {
    throw new Error("Monday API returned no data");
  }

  return body.data;
}

async function getBoardSchema(token: string, boardId: number) {
  console.log(`[monday-export] loading board schema for board ${boardId}`);
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const data = await gql<{ boards?: MondayBoard[] }>(token, query, { boardId: [boardId] });
  const board = data.boards?.[0];
  if (!board) {
    throw new Error(`No board found for id=${boardId}. Check MONDAY_BOARD_ID and token access.`);
  }

  const columns = board.columns ?? [];
  console.log(
    `[monday-export] loaded board schema: board="${board.name}" columns=${columns.length}`,
  );
  return {
    boardName: board.name,
    columns,
    columnTitleById: new Map(columns.map((column) => [column.id, column.title])),
  };
}

async function fetchItemsPage(token: string, boardId: number, limit: number, cursor?: string | null) {
  console.log(
    `[monday-export] fetching items page: board=${boardId} limit=${limit} cursor=${cursor ?? "<start>"}`,
  );
  const query = cursor
    ? `
      query ($boardId: [ID!], $limit: Int!, $cursor: String!) {
        boards(ids: $boardId) {
          items_page(limit: $limit, cursor: $cursor) {
            cursor
            items {
              id
              name
              created_at
              updated_at
              group { id title color }
              column_values { id type text value }
            }
          }
        }
      }
    `
    : `
      query ($boardId: [ID!], $limit: Int!) {
        boards(ids: $boardId) {
          items_page(limit: $limit) {
            cursor
            items {
              id
              name
              created_at
              updated_at
              group { id title color }
              column_values { id type text value }
            }
          }
        }
      }
    `;

  const variables = cursor
    ? { boardId: [boardId], limit, cursor }
    : { boardId: [boardId], limit };

  const data = await gql<{ boards?: MondayBoard[] }>(token, query, variables);
  const page = data.boards?.[0]?.items_page ?? { cursor: null, items: [] };
  console.log(
    `[monday-export] page fetched: items=${page.items?.length ?? 0} nextCursor=${page.cursor ?? "<end>"}`,
  );
  return page;
}

function normalizeCell(columnValue: MondayColumnValue) {
  const text = columnValue.text?.trim();
  if (text) return text;
  return columnValue.value ?? "";
}

async function main() {
  const token = process.env.MONDAY_API_KEY ?? assertEnv("MONDAY_TOKEN");
  const boardId = parseBoardId();
  const pageLimit = parsePageLimit();
  const outputPath = path.resolve(
    process.cwd(),
    getArg("--output", process.env.OUTPUT_CSV ?? `monday_board_${boardId}.csv`) ??
      `monday_board_${boardId}.csv`,
  );

  console.log("[monday-export] starting export", {
    boardId,
    pageLimit,
    outputPath,
    tokenSource: process.env.MONDAY_API_KEY ? "MONDAY_API_KEY" : "MONDAY_TOKEN",
  });

  const { boardName, columns, columnTitleById } = await getBoardSchema(token, boardId);
  const fixedHeaders = [
    "item_id",
    "item_name",
    "group_id",
    "group_title",
    "group_color",
    "created_at",
    "updated_at",
  ];
  const headers = [...fixedHeaders, ...columns.map((column) => column.title)];
  const writer = createWriteStream(outputPath, { encoding: "utf8" });

  console.log(`[monday-export] opened output file ${outputPath}`);
  writer.write(`${headers.map(escapeCsv).join(",")}\n`);
  console.log(`[monday-export] wrote CSV header with ${headers.length} columns`);

  let rowsWritten = 0;
  let pageCount = 0;
  let cursor: string | null | undefined = null;

  while (true) {
    const page = await fetchItemsPage(token, boardId, pageLimit, cursor);
    const items = page.items ?? [];
    cursor = page.cursor;
    pageCount += 1;

    for (const item of items) {
      const row = Object.fromEntries(headers.map((header) => [header, ""])) as Record<string, string>;
      row.item_id = item.id ?? "";
      row.item_name = item.name ?? "";
      row.created_at = item.created_at ?? "";
      row.updated_at = item.updated_at ?? "";
      row.group_id = item.group?.id ?? "";
      row.group_title = item.group?.title ?? "";
      row.group_color = item.group?.color ?? "";

      for (const columnValue of item.column_values ?? []) {
        const title = columnTitleById.get(columnValue.id);
        if (!title) continue;
        row[title] = normalizeCell(columnValue);
      }

      writer.write(`${headers.map((header) => escapeCsv(row[header])).join(",")}\n`);
      rowsWritten += 1;
    }

    console.log(
      `[monday-export] wrote page ${pageCount}: pageItems=${items.length} totalRows=${rowsWritten}`,
    );

    if (!cursor) break;
    console.log("[monday-export] sleeping 200ms before next page");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  writer.end();
  await finished(writer);
  console.log(
    `[monday-export] completed export: rows=${rowsWritten} pages=${pageCount} board=${boardId} (${boardName}) output=${outputPath}`,
  );
}

main().catch((error) => {
  console.error("[monday-export] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
