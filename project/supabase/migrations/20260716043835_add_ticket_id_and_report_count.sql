/*
# Add ticket_id and report_count columns to tickets table

1. Modified Tables
- `tickets`
  - `ticket_id` (text, unique) — human-readable ID like "GRIEV-2026-409"
  - `report_count` (integer, default 1) — crowdsourced escalation counter
  - `priority` (text, default 'Low') — Low | Medium | High | Critical

2. Notes
- `ticket_id` is generated client-side and passed in the insert.
- `report_count` starts at 1 and increments when a duplicate (same category + location) is submitted.
- `priority` is derived from report_count: 1=Low/Medium, 2=High, 3+=Critical.
- No data loss — existing rows get sensible defaults.
*/

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_id text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Low';

-- Backfill ticket_id for existing rows that have none, using a CTE
WITH numbered AS (
  SELECT id, row_number() OVER () AS rn FROM tickets WHERE ticket_id IS NULL
)
UPDATE tickets t
SET ticket_id = 'GRIEV-2026-' || lpad(n.rn::text, 3, '0')
FROM numbered n
WHERE t.id = n.id;

-- Make ticket_id unique after backfill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_ticket_id_key'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_id_key UNIQUE (ticket_id);
  END IF;
END $$;
