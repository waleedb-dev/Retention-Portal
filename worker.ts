import "dotenv/config"
import { redis } from "./src/lib/redis"
import { getSupabaseAdmin } from "./src/lib/supabase"

const supabaseAdmin = getSupabaseAdmin()

type MondayItem = {
  id: string
  name: string
  group?: {
    id: string
    title: string
    color?: string
  } | null
  column_values?: Array<{
    id: string
    text: string | null
    value: string | null
    type?: string
    column?: { title: string }
  }>
}

async function fetchMondayItem(itemId: string): Promise<MondayItem | null> {
  const apiKey = process.env.MONDAY_API_KEY

  if (!apiKey) {
    throw new Error("Missing MONDAY_API_KEY")
  }

  const query = `query ($itemId: [ID!]) {
    items(ids: $itemId) {
      id
      name
      group {
        id
        title
        color
      }
      column_values {
        id
        text
        value
        type
        column {
          title
        }
      }
    }
  }`

  const resp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables: { itemId: [itemId] } }),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Monday API HTTP ${resp.status}: ${txt}`)
  }

  const json = (await resp.json()) as {
    data?: { items?: MondayItem[] }
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "))
  }

  const item = json.data?.items?.[0]
  return item ?? null
}

function getColumnText(item: MondayItem, matcher: (title: string) => boolean): string | null {
  const col = item.column_values?.find((c) => matcher(c.column?.title ?? ""))
  return col?.text ?? null
}

async function upsertLeadFromMonday(item: MondayItem) {
  // No DB schema changes: we store Monday ID into an existing text column.
  // Assumption (per earlier recommendation): public.leads.submission_id stores Monday Item ID.
  const submissionId = item.id

  // Map what we safely can to existing columns from your current table.
  const phone = getColumnText(item, (t) => t.toLowerCase() === "phone number")
  const email = getColumnText(item, (t) => t.toLowerCase() === "email")
  const notes =
    getColumnText(item, (t) => t.toLowerCase() === "notes") ??
    getColumnText(item, (t) => t.toLowerCase() === "additional notes")

  const payload: Record<string, unknown> = {
    submission_id: submissionId,
    // Use existing columns where they exist in your table
    customer_full_name: item.name,
    phone_number: phone,
    email,
    additional_notes: notes,
    updated_at: new Date().toISOString(),
  }

  // Upsert by submission_id requires a unique constraint in DB; since we are not altering schema,
  // we do a best-effort update-first, insert-if-missing.
  const { data: existing, error: findError } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("submission_id", submissionId)
    .maybeSingle()

  if (findError) {
    throw findError
  }

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update(payload)
      .eq("id", existing.id)

    if (updateError) {
      throw updateError
    }

    console.log(`[worker] updated lead id=${existing.id} submission_id=${submissionId}`)

    return
  }

  const { error: insertError } = await supabaseAdmin.from("leads").insert(payload)

  if (insertError) {
    throw insertError
  }

  console.log(`[worker] inserted lead submission_id=${submissionId}`)
}

async function main() {
  console.log("[worker] starting")
  console.log(`[worker] redis=${process.env.REDIS_URL ? "set" : "missing"}`)
  console.log(`[worker] supabase_url=${process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing"}`)
  console.log(`[worker] monday_api_key=${process.env.MONDAY_API_KEY ? "set" : "missing"}`)

  while (true) {
    const result = await redis.brpop("sync:queue", 0)

    if (!result || result.length < 2) {
      continue
    }

    const itemId = result[1]

    try {
      console.log(`Processing Item ID: ${itemId}`)

      const item = await fetchMondayItem(itemId)

      if (!item) {
        console.log(`[worker] item not found itemId=${itemId}`)
        await redis.srem("sync:active_ids", itemId)
        continue
      }

      console.log("[worker] monday item fetched", {
        id: item.id,
        name: item.name,
        group: item.group ? { id: item.group.id, title: item.group.title, color: item.group.color } : null,
      })

      await upsertLeadFromMonday(item)

      await redis.srem("sync:active_ids", itemId)
      console.log(`[worker] done itemId=${itemId}`)
    } catch (err) {
      console.error(`[worker] failed itemId=${itemId}`, err)
      try {
        await redis.srem("sync:active_ids", itemId)
      } catch (cleanupErr) {
        console.error(`[worker] cleanup failed itemId=${itemId}`, cleanupErr)
      }
    }
  }
}

main().catch((err) => {
  console.error("Worker crashed:", err)
  process.exit(1)
})
