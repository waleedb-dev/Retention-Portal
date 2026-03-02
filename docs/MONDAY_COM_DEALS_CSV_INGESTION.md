# Monday `monday_com_deals` CSV Ingestion

## Summary

This document describes how `monday_com_deals` was reloaded from a local Monday export CSV using the repo scripts, while preserving app-managed fields from a previously exported Supabase backup.

Source CSV:

- `monday_board_18027763264.csv`

Preservation backup used:

- `monday_com_deals.backup.2026-03-02T18-26-24-182Z.csv`

Primary reload script:

- `scripts/reload_monday_com_deals.ts`

Mapping test script:

- `scripts/test_monday_csv_mapping.ts`

Shared mapping logic:

- `src/lib/monday-deals/extract.ts`

CSV parser:

- `src/lib/monday-deals/csv.ts`

## How Ingestion Works

The reload path uses the same canonical field mapping as the Monday webhook. The mapping is not redefined in the reload script.

Raw source metadata:

- `item_id` -> `monday_item_id`
- `item_name` -> `deal_name`
- `group_title` -> `group_title`
- `group_color` -> `group_color`

Monday board column titles -> Supabase columns:

- `GHL Name` -> `ghl_name`
- `GHL Stage` -> `ghl_stage`
- `Policy Status` -> `policy_status`
- `Deal creation date` -> `deal_creation_date`
- `Policy Number` -> `policy_number`
- `Deal Value` -> `deal_value`
- `CC Value` -> `cc_value`
- `Notes` -> `notes`
- `Status` -> `status`
- `Last updated` -> `last_updated`
- `Sales Agent` -> `sales_agent`
- `Writing #` -> `writing_no`
- `Carrier` -> `carrier`
- `Commission Type` -> `commission_type`
- `Effective Date` -> `effective_date`
- `Call Center` -> `call_center`
- `Phone Number` -> `phone_number`
- `CC PMT WS` -> `cc_pmt_ws`
- `CC CB WS` -> `cc_cb_ws`
- `Carrier Status` -> `carrier_status`
- `Lead Creation Date` -> `lead_creation_date`
- `Policy Type` -> `policy_type`

Preserved from backup when the same `monday_item_id` already existed:

- `created_at`
- `updated_at`
- `disposition`
- `disposition_date`
- `disposition_agent_id`
- `disposition_agent_name`
- `disposition_notes`
- `callback_datetime`
- `disposition_count`

Notes:

- Empty timestamp values from the preservation CSV are normalized to `null`.
- New rows that did not exist in the old table receive valid `created_at` and `updated_at` fallback values.
- JSON-like CSV date cells are handled the same way as the existing webhook extractor, so invalid raw JSON blobs are not inserted into timestamp/date columns.

## Execution Flow

1. Validate the source CSV shape and mapping.
2. Load preservation rows from the existing backup CSV.
3. Parse the source CSV into the canonical `monday_com_deals` field shape.
4. Delete existing rows from `monday_com_deals`.
5. Reinsert rows in batches.
6. Validate live DB rows against the source CSV mapping by `monday_item_id`.
7. Report any `ghl_stage` values that are not covered by `STAGE_TO_MAPPING`.

## Commands Used

Mapping validation:

```bash
npm run monday:test-csv-mapping -- --input-csv monday_board_18027763264.csv
```

Reload using the existing preservation backup and skipping a fresh backup:

```bash
npm run monday:reload-deals -- \
  --skip-backup \
  --confirm-delete-live-table \
  --preserve-from-backup-csv monday_com_deals.backup.2026-03-02T18-26-24-182Z.csv \
  --input-csv monday_board_18027763264.csv
```

## Results

### Source and Preservation Inputs

- Source CSV rows parsed: `7,828`
- Preservation backup rows loaded: `8,248`
- Existing live rows at final rerun start: `0`

### Reload Outcome

- Deleted existing `monday_com_deals` rows successfully
- Inserted `7,828 / 7,828` rows successfully
- Post-load validation passed for all `7,828` rows

### Validation Outcome

The script validated live `monday_com_deals` rows against the mapped source rows by `monday_item_id` and reported:

- `validation passed for 7828 rows`

### Unmapped `ghl_stage` Values

These stages were present in the source data but are not currently covered by `STAGE_TO_MAPPING` in `src/lib/monday-deal-category-tags.ts`:

- `Declined Underwriting`: `1370`
- `ACTIVE - 3 Months +`: `1067`
- `Active Placed - Paid as Advanced`: `956`
- `Application Withdrawn`: `886`
- `Issued - Pending First Draft`: `348`
- `CANNOT BE FOUND IN CARRIER`: `260`
- `Premium Paid - Commission Pending`: `196`
- `Pending Approval`: `145`
- `Active Placed - Paid as Earned`: `28`
- `Charge Back Cancellation`: `18`
- `ACTIVE PLACED - Paid as Advanced`: `8`

This is a classification coverage gap, not a reload failure.

## Important Caveats

- The reload repopulated the existing `monday_com_deals` columns; it did not rename the schema.
- `tasks` exists in the historical schema/backup CSV, but it is not part of the canonical reload mapping and was not sourced from the Monday CSV.
- The reload does not preserve the internal numeric `monday_com_deals.id` values. Any downstream records that reference `deal_id` may need verification after reload.
- `--skip-backup` was intentionally used on the successful rerun because the correct preservation source was the earlier full backup, not the partially reloaded live table.

## Suggested Post-Reload Checks

Run these checks after the reload:

```sql
select
  count(*) as rows,
  count(distinct monday_item_id) as distinct_item_ids,
  count(*) filter (where monday_item_id is null) as null_item_ids,
  count(*) filter (where created_at is null) as null_created_at,
  count(*) filter (where updated_at is null) as null_updated_at
from monday_com_deals;
```

Expected:

- `rows = 7828`
- `distinct_item_ids = 7828`
- no null `monday_item_id`
- no null `created_at`
- no null `updated_at`

Check for broken assignment references:

```sql
select count(*) as orphaned_assignments
from retention_assigned_leads ral
left join monday_com_deals d on d.id = ral.deal_id
where ral.deal_id is not null
  and d.id is null;
```

## Ticket-Ready Summary

Reloaded `monday_com_deals` from `monday_board_18027763264.csv` using the repo reload script and the existing canonical Monday-to-Supabase mapping. Used `monday_com_deals.backup.2026-03-02T18-26-24-182Z.csv` as the preservation source for app-managed fields (`created_at`, `updated_at`, disposition fields, callback fields, `disposition_count`). Inserted `7,828` rows and completed post-load validation successfully against the source CSV by `monday_item_id`. No schema rename was performed. The remaining issue is classification coverage only: several `ghl_stage` values in the source data are not currently mapped in `STAGE_TO_MAPPING`.
