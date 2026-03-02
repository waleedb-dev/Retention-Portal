import { readFile } from "node:fs/promises"
import type { MondayCsvRow } from "./extract"

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\""
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      values.push(current)
      current = ""
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

export function parseCsv(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalized.split("\n")

  const logicalRows: string[] = []
  let buffer = ""
  let quoteCount = 0

  for (const line of lines) {
    if (buffer.length > 0) {
      buffer += "\n"
    }
    buffer += line

    const escapedQuotes = line.match(/""/g)?.length ?? 0
    const unescapedQuoteCount = (line.match(/"/g)?.length ?? 0) - escapedQuotes * 2
    quoteCount += unescapedQuoteCount

    if (quoteCount % 2 === 0) {
      logicalRows.push(buffer)
      buffer = ""
      quoteCount = 0
    }
  }

  if (buffer.trim().length > 0) {
    logicalRows.push(buffer)
  }

  const nonEmptyRows = logicalRows.filter((row) => row.length > 0)
  if (nonEmptyRows.length === 0) {
    return { headers: [] as string[], rows: [] as MondayCsvRow[] }
  }

  const headers = parseCsvLine(nonEmptyRows[0])
  const rows = nonEmptyRows.slice(1).map((row) => {
    const values = parseCsvLine(row)
    const record: MondayCsvRow = {}

    headers.forEach((header, index) => {
      record[header] = values[index] ?? ""
    })

    return record
  })

  return { headers, rows }
}

export async function readCsvFile(filePath: string) {
  const text = await readFile(filePath, "utf8")
  return parseCsv(text)
}
