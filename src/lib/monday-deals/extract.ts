export type MondayItem = {
  id: string
  name: string
  created_at?: string | null
  updated_at?: string | null
  group?: {
    id: string
    title: string
    color?: string | null
  } | null
  column_values?: Array<{
    id: string
    text: string | null
    value: string | null
    type?: string | null
    column?: { id: string; title: string } | null
  }>
}

export type MondayCsvRow = Record<string, string>

export type DealFields = {
  monday_item_id: string
  deal_name: string | null
  ghl_name: string | null
  ghl_stage: string | null
  policy_status: string | null
  deal_creation_date: string | null
  policy_number: string | null
  deal_value: number | null
  cc_value: number | null
  notes: string | null
  status: string | null
  last_updated: string | null
  sales_agent: string | null
  writing_no: string | null
  carrier: string | null
  commission_type: string | null
  effective_date: string | null
  call_center: string | null
  phone_number: string | null
  cc_pmt_ws: string | null
  cc_cb_ws: string | null
  carrier_status: string | null
  lead_creation_date: string | null
  policy_type: string | null
  group_title: string | null
  group_color: string | null
}

export const DEAL_FIELD_KEYS: Array<keyof DealFields> = [
  "monday_item_id",
  "deal_name",
  "ghl_name",
  "ghl_stage",
  "policy_status",
  "deal_creation_date",
  "policy_number",
  "deal_value",
  "cc_value",
  "notes",
  "status",
  "last_updated",
  "sales_agent",
  "writing_no",
  "carrier",
  "commission_type",
  "effective_date",
  "call_center",
  "phone_number",
  "cc_pmt_ws",
  "cc_cb_ws",
  "carrier_status",
  "lead_creation_date",
  "policy_type",
  "group_title",
  "group_color",
]

export const CSV_REQUIRED_HEADERS = [
  "item_id",
  "item_name",
  "group_title",
  "group_color",
  "GHL Name",
  "GHL Stage",
  "Policy Status",
  "Deal creation date",
  "Policy Number",
  "Deal Value",
  "CC Value",
  "Notes",
  "Status",
  "Last updated",
  "Sales Agent",
  "Writing #",
  "Carrier",
  "Commission Type",
  "Effective Date",
  "Call Center",
  "Phone Number",
  "CC PMT WS",
  "CC CB WS",
  "Carrier Status",
  "Policy Type",
] as const

type ColumnValueEntry = {
  text: string | null
  value: string | null
  type?: string | null
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v !== "string") return null
  const cleaned = v.replace(/[^0-9.+-]/g, "").trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function normalizeString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== "string") return null
  const s = v.trim()
  return s.length ? s : null
}

function getEntryByTitle(map: Map<string, ColumnValueEntry>, title: string) {
  return map.get(title)
}

function getStringField(map: Map<string, ColumnValueEntry>, title: string) {
  const e = getEntryByTitle(map, title)
  return normalizeString(e?.text ?? null) ?? normalizeString(e?.value ?? null)
}

function getDateField(map: Map<string, ColumnValueEntry>, title: string) {
  const e = getEntryByTitle(map, title)

  const rawValue = normalizeString(e?.value ?? null)
  if (rawValue && (rawValue.startsWith("{") || rawValue.startsWith("["))) {
    try {
      const parsed = JSON.parse(rawValue) as { date?: string }
      const d = normalizeString(parsed?.date)
      if (d) return d
    } catch {
      console.log("[monday-deals] getDateField: failed to parse date")
    }
  }

  return normalizeString(e?.text ?? null)
}

export function extractDealFields(item: MondayItem): DealFields {
  const m = new Map<string, ColumnValueEntry>()

  for (const cv of item.column_values ?? []) {
    const title = cv.column?.title?.trim()
    if (!title) continue
    m.set(title, { text: cv.text ?? null, value: cv.value ?? null, type: cv.type })
  }

  const dealName = normalizeString(item.name) ?? null

  return {
    monday_item_id: item.id,
    deal_name: dealName,
    ghl_name: getStringField(m, "GHL Name"),
    ghl_stage: getStringField(m, "GHL Stage"),
    policy_status: getStringField(m, "Policy Status"),
    deal_creation_date: getDateField(m, "Deal creation date"),
    policy_number: getStringField(m, "Policy Number"),
    deal_value: toNumber(getStringField(m, "Deal Value")),
    cc_value: toNumber(getStringField(m, "CC Value")),
    notes: getStringField(m, "Notes"),
    status: getStringField(m, "Status"),
    last_updated: getDateField(m, "Last updated"),
    sales_agent: getStringField(m, "Sales Agent"),
    writing_no: getStringField(m, "Writing #"),
    carrier: getStringField(m, "Carrier"),
    commission_type: getStringField(m, "Commission Type"),
    effective_date: getDateField(m, "Effective Date"),
    call_center: getStringField(m, "Call Center"),
    phone_number: getStringField(m, "Phone Number"),
    cc_pmt_ws: getStringField(m, "CC PMT WS"),
    cc_cb_ws: getStringField(m, "CC CB WS"),
    carrier_status: getStringField(m, "Carrier Status"),
    lead_creation_date: getDateField(m, "Lead Creation Date"),
    policy_type: getStringField(m, "Policy Type"),
    group_title: item.group?.title ?? null,
    group_color: item.group?.color ?? null,
  }
}

function csvValue(row: MondayCsvRow, key: string) {
  return row[key] ?? ""
}

function buildCsvColumnValue(raw: string | undefined, id: string, title: string) {
  const value = raw ?? ""
  const trimmed = value.trim()
  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[")

  return {
    id,
    text: looksLikeJson ? null : value || null,
    value: value || null,
    type: null,
    column: { id, title },
  }
}

export function buildMondayItemFromCsvRow(row: MondayCsvRow): MondayItem {
  const columnTitles = [
    "GHL Name",
    "GHL Stage",
    "Policy Status",
    "Deal creation date",
    "Policy Number",
    "Deal Value",
    "CC Value",
    "Notes",
    "Status",
    "Last updated",
    "Sales Agent",
    "Writing #",
    "Carrier",
    "Commission Type",
    "Effective Date",
    "Call Center",
    "Phone Number",
    "CC PMT WS",
    "CC CB WS",
    "Carrier Status",
    "Lead Creation Date",
    "Policy Type",
  ] as const

  return {
    id: csvValue(row, "item_id"),
    name: csvValue(row, "item_name"),
    created_at: csvValue(row, "created_at") || null,
    updated_at: csvValue(row, "updated_at") || null,
    group: {
      id: csvValue(row, "group_id"),
      title: csvValue(row, "group_title"),
      color: csvValue(row, "group_color") || null,
    },
    column_values: columnTitles.map((title, index) =>
      buildCsvColumnValue(row[title], `csv_${index}`, title),
    ),
  }
}

export function extractDealFieldsFromCsvRow(row: MondayCsvRow): DealFields {
  return extractDealFields(buildMondayItemFromCsvRow(row))
}
