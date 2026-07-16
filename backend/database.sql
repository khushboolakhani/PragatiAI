-- Grievance Routing System — Database Schema (v2)
-- Rewritten to match the actual frontend's Ticket type field-for-field,
-- since the frontend (built in Bolt) uses different names than the
-- original plan (e.g. "category" not "department", "title" not
-- "complaint_text", "submitted_by" not a Users foreign key).

CREATE TABLE IF NOT EXISTS tickets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      TEXT UNIQUE,                 -- e.g. "GRIEV-2026-004", set after insert
  title          TEXT NOT NULL,                -- short complaint text, e.g. "Large pothole on Main Street"
  category       TEXT NOT NULL,                -- AI-determined department, e.g. "Water Supply", "Roads & Infrastructure" (mirrors ai_department)
  location       TEXT NOT NULL,                -- ward, e.g. "Ward A (Colaba/Fort)"
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_review' | 'resolved'  (lowercase — matches frontend STATUS_META keys)
  submitted_by   TEXT NOT NULL,                -- citizen email
  report_count   INTEGER NOT NULL DEFAULT 1,   -- incremented on duplicate (same AI category + location)
  priority       TEXT NOT NULL DEFAULT 'Low',  -- 'Low' | 'Medium' | 'High' | 'Critical' — ai_priority escalated by report_count
  ai_department  TEXT,                          -- department predicted by the AI /analyze service — this IS the category now
  ai_confidence  REAL,
  ai_summary     TEXT,
  ai_priority    TEXT,                          -- AI's baseline priority estimate, before report-count escalation
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks the last time a ticket was auto-escalated for staleness, so we
-- don't re-escalate/re-notify on every check cycle.
ALTER TABLE tickets ADD COLUMN last_escalated_at DATETIME;

-- One row per reminder sent to a department for an overdue ticket.
-- Powers the "Department Reminders" panel on the admin dashboard.
CREATE TABLE IF NOT EXISTS reminders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id    TEXT NOT NULL,          -- matches tickets.ticket_id
  department   TEXT NOT NULL,          -- snapshot of tickets.category at the time
  days_open    INTEGER NOT NULL,
  old_priority TEXT NOT NULL,
  new_priority TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);