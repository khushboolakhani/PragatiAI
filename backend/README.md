# Grievance Backend (v2 — matches actual frontend)

This version replaces the earlier `/complaint`, `/status`, `/complaints`, `/update`
design. Your Bolt-built frontend turned out to call Supabase directly with a
different field/table shape (`tickets`, not `Complaints`) and built-in
crowdsourced dedup logic — this backend now mirrors that exactly so `src/api.ts`
in the frontend can talk to it with a straight `fetch()` swap instead of
`supabase-js`.

## What changed from v1
- Table renamed `Complaints` → `tickets`, with fields matching the frontend's
  `Ticket` type exactly: `title`, `category`, `location`, `submitted_by`,
  `report_count`, `priority`, `status` (lowercase: `pending` / `in_review` / `resolved`).
- Endpoints moved under `/api`: `/api/tickets`, `/api/tickets/user`, `/api/tickets/search`.
- **Dedup logic lives in the backend now**, not the frontend: submitting a
  ticket with the same `category` + `location` as an existing one increments
  `report_count` and recomputes `priority` instead of creating a new row —
  same rule as the frontend's old `computePriority()`:
  - `report_count === 1` → `Low`
  - `report_count === 2` → `High`
  - `report_count >= 3` → `Critical`
- The AI service is still called on every new ticket (using `title` as the
  complaint text), but its output (`ai_department`, `ai_confidence`,
  `ai_summary`) is **informational only** — it doesn't override the citizen's
  chosen `category` or the dedup-driven `priority`. Useful for the "System NLP
  Logs" panel or admin cross-checking.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET | `/api/tickets` | All tickets, newest first |
| GET | `/api/tickets/user?email=...` | One citizen's tickets |
| GET | `/api/tickets/search?q=...` | Search title/category/location |
| POST | `/api/tickets` | Submit (dedup + AI classification) |
| PUT | `/api/tickets/:ticketId` | Update status — **not yet wired up in the frontend**, but ready |

### POST /api/tickets
Request:
```json
{
  "title": "Large pothole on Main Street",
  "category": "Road Hazards",
  "location": "Ward A (Colaba/Fort)",
  "submitted_by": "citizen@gmail.com"
}
```
Response (new ticket):
```json
{
  "ticket": {
    "id": 1,
    "ticket_id": "GRIEV-2026-001",
    "title": "Large pothole on Main Street",
    "category": "Road Hazards",
    "location": "Ward A (Colaba/Fort)",
    "status": "pending",
    "submitted_by": "citizen@gmail.com",
    "report_count": 1,
    "priority": "Low",
    "ai_department": "Roads & Infrastructure",
    "ai_confidence": 0.91,
    "ai_summary": "...",
    "created_at": "2026-07-16 04:12:00"
  },
  "isDuplicate": false,
  "aiAvailable": true
}
```
Response shape matches the frontend's `SubmitResult` interface exactly, so
`result.ticket` and `result.isDuplicate` work with zero changes to `App.tsx`.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Start the AI service first (`cd ai && python predict.py`), then the backend.
Check `http://localhost:5000/health` before touching the frontend.

## Frontend changes needed

1. `src/api.ts` has been rewritten to call this backend via `fetch()` instead
   of `supabase-js`. Drop the version from this package into your frontend's
   `src/api.ts`, replacing the old one.
2. Add to your frontend's `.env` (keep your existing Supabase lines if you
   want, they're just unused now):
   ```
   VITE_API_BASE_URL=http://localhost:5000
   ```
3. `src/vite-env.d.ts` needs `VITE_API_BASE_URL` added to `ImportMetaEnv` —
   already done in the copy included here.
4. `src/supabaseClient.ts` is now unused (nothing imports it) — safe to leave
   or delete.
5. Run your frontend as usual (`npm run dev` in the frontend project) and it
   should hit the Express backend instead of Supabase.

## Testing without Postman
```bash
curl.exe -X POST http://localhost:5000/api/tickets -H "Content-Type: application/json" -d "{\"title\":\"Large pothole on Main Street\",\"category\":\"Road Hazards\",\"location\":\"Ward A (Colaba/Fort)\",\"submitted_by\":\"citizen@gmail.com\"}"
```
(Windows PowerShell: use `curl.exe`, not the bare `curl` alias — see earlier note.)

Then confirm dedup works by submitting the **same** `category` + `location`
again with a different title — `report_count` should go to 2 and `priority`
to `High`.

## Deploying to Render
Same as before: Root Directory `backend`, Build `npm install`, Start `npm start`.
Add `AI_SERVICE_URL` and `ALLOWED_ORIGINS` (your deployed frontend URL) as env vars.
Remember: SQLite on Render's free tier is wiped on redeploy — fine for a demo,
ask if you want the Postgres swap later.
