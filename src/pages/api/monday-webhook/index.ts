import type { NextApiRequest, NextApiResponse } from "next"

// TODO: In the future, if high throughput or debouncing is required, reintroduce Redis-based queuing from this handler.
// import { redis } from "@/lib/redis"
import { extractDealFields, type MondayItem } from "@/lib/monday-deals/extract"
import { getSupabaseAdmin } from "@/lib/supabase"

async function fetchMondayItem(itemId: string): Promise<MondayItem | null> {
  const apiKey = process.env.MONDAY_API_KEY

  if (!apiKey) {
    console.log("[webhook] Missing MONDAY_API_KEY (skipping Monday fetch)")
    return null
  }

  console.log(`[webhook] fetching monday item id=${itemId}`)

  const query = `query ($itemId: [ID!]) {
    items(ids: $itemId) {
      id
      name
      created_at
      updated_at
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
          id
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

  const bodyText = await resp
    .clone()
    .text()
    .catch(() => "")

  console.log(`[webhook] monday item fetch status=${resp.status} ok=${resp.ok}`)

  if (bodyText) {
    console.log("[webhook] monday item fetch body", bodyText)
  }

  if (!resp.ok) {
    console.log(`[webhook] Monday API error status=${resp.status}`)
    return null
  }

  let json: {
    data?: { items?: MondayItem[] }
    errors?: unknown
  } = {}

  try {
    json = JSON.parse(bodyText) as {
      data?: { items?: MondayItem[] }
      errors?: unknown
    }
  } catch {
    console.log("[webhook] Monday API returned non-JSON body")
    return null
  }

  if (json?.errors) {
    console.log("[webhook] Monday GraphQL errors", json.errors)
  }

  const item = json?.data?.items?.[0]
  if (!item) {
    console.log(`[webhook] Monday item not found id=${itemId}`)
  }
  return item ?? null
}

type MondayWebhookBody = {
  challenge?: string
  event?: {
    pulseId?: number | string
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const body = req.body as MondayWebhookBody

  if (body?.challenge) {
    console.log("[webhook] monday challenge")
    return res.status(200).json({ challenge: body.challenge })
  }

  const pulseId = body?.event?.pulseId

  if (pulseId === undefined || pulseId === null || pulseId === "") {
    console.log("[webhook] received (no pulseId)")
    return res.status(200).json({ received: true })
  }

  const id = String(pulseId)

  try {
    console.log(`[webhook] received pulseId=${id}`)
    // Direct processing: fetch Monday item and upsert into Supabase without queuing
    const item = await fetchMondayItem(id)
    if (item) {
      console.log("[webhook] monday item", {
        id: item.id,
        name: item.name,
        group: item.group
          ? { id: item.group.id, title: item.group.title, color: item.group.color }
          : null,
      })

      const extracted = extractDealFields(item)
      console.log("[webhook] extracted deal fields", extracted)
      console.log("[webhook] deal_creation_date", extracted.deal_creation_date)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { error } = await supabaseAdmin
          .from("monday_com_deals")
          .upsert(extracted, { onConflict: "monday_item_id" })

        if (error) {
          console.error("[webhook] supabase upsert error", error)
        } else {
          console.log(`[webhook] supabase upsert ok monday_item_id=${extracted.monday_item_id}`)
        }
      } catch (err) {
        console.error("[webhook] supabase upsert exception", err)
      }
    } else {
      console.log(`[webhook] monday item fetch returned null id=${id}`)
    }
  } catch (err) {
    console.error(`[webhook] error pulseId=${id}`, err)
  }

  return res.status(200).json({ received: true })
}
