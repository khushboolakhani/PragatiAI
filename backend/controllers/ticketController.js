const db = require('../config/db');
const { analyzeComplaint } = require('../config/aiService');

// Priority now starts from the AI's own estimate (Low/Medium/High) for the
// complaint's text, then escalates based on how many citizens have reported
// the same issue (same AI-determined department + location). Report volume
// can only push priority UP, never down — 2+ reports guarantees at least
// High, 3+ guarantees Critical, regardless of what the AI guessed alone.
const PRIORITY_RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 };
const RANK_TO_PRIORITY = ['Low', 'Medium', 'High', 'Critical'];

function computePriority(basePriority, reportCount) {
  let rank = PRIORITY_RANK[basePriority] ?? PRIORITY_RANK.Low;
  if (reportCount >= 3) rank = Math.max(rank, PRIORITY_RANK.Critical);
  else if (reportCount === 2) rank = Math.max(rank, PRIORITY_RANK.High);
  return RANK_TO_PRIORITY[rank];
}

function padTicketNumber(id) {
  return String(id).padStart(3, '0');
}

// ---------------------------------------------------------------------
// GET /api/tickets
// All tickets, newest first — powers the Admin dashboard table + the
// Citizen portal's public ticket list.
// ---------------------------------------------------------------------
function listTickets(req, res) {
  db.all('SELECT * FROM tickets ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('listTickets error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(rows);
  });
}

// ---------------------------------------------------------------------
// GET /api/tickets/user?email=...
// A single citizen's own tickets — powers the "Track Your Grievances" feed
// ---------------------------------------------------------------------
function listUserTickets(req, res) {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'email query param is required' });
  }

  db.all(
    'SELECT * FROM tickets WHERE submitted_by = ? ORDER BY created_at DESC',
    [email],
    (err, rows) => {
      if (err) {
        console.error('listUserTickets error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json(rows);
    }
  );
}

// ---------------------------------------------------------------------
// GET /api/tickets/search?q=...
// Case-insensitive substring match across title, category, location —
// mirrors the frontend's old .ilike(...) search across those same fields.
// ---------------------------------------------------------------------
function searchTickets(req, res) {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json([]);
  }

  const like = `%${q.toLowerCase()}%`;
  const sql = `
    SELECT * FROM tickets
    WHERE LOWER(title) LIKE ? OR LOWER(category) LIKE ? OR LOWER(location) LIKE ?
    ORDER BY created_at DESC
  `;

  db.all(sql, [like, like, like], (err, rows) => {
    if (err) {
      console.error('searchTickets error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(rows);
  });
}

// ---------------------------------------------------------------------
// POST /api/tickets
// Body: { title, location, submitted_by }
//
// The citizen no longer picks a category — the AI classifies the
// complaint text and its department guess becomes the ticket's category.
// That also means the AI has to run BEFORE we know the dedup key, so the
// flow is: classify first, then look up/increment or insert.
//
// Dedup logic:
//   - If a ticket already exists with the same AI-determined category +
//     location, increment its report_count and recompute priority
//     (starting from that ticket's original AI priority estimate)
//     instead of creating a new row.
//   - Otherwise, create a new ticket with the AI's department, confidence,
//     summary, and priority estimate all stored on it.
//
// Response shape: { ticket, isDuplicate, aiAvailable } — matches the
// frontend's SubmitResult interface so api.ts can be a near-drop-in
// replacement.
// ---------------------------------------------------------------------
async function createOrIncrementTicket(req, res) {
  try {
    const { title, location, submitted_by } = req.body;

    if (!title || !location || !submitted_by) {
      return res.status(400).json({ error: 'title, location, and submitted_by are all required' });
    }

    // Classify first — the AI's department decides the category, and its
    // priority estimate is the baseline before report-count escalation.
    const aiResult = await analyzeComplaint(title);
    const category = aiResult.department;

    db.get(
      'SELECT * FROM tickets WHERE category = ? AND location = ?',
      [category, location],
      (err, existing) => {
        if (err) {
          console.error('createOrIncrementTicket lookup error:', err.message);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (existing) {
          const newCount = existing.report_count + 1;
          // Escalate from this ticket group's original AI priority estimate,
          // not the newest report's, so priority only ever ratchets up.
          const basePriority = existing.ai_priority || aiResult.priority;
          const newPriority = computePriority(basePriority, newCount);

          db.run(
            'UPDATE tickets SET report_count = ?, priority = ? WHERE id = ?',
            [newCount, newPriority, existing.id],
            function (err) {
              if (err) {
                console.error('createOrIncrementTicket update error:', err.message);
                return res.status(500).json({ error: 'Internal server error' });
              }
              db.get('SELECT * FROM tickets WHERE id = ?', [existing.id], (err, updated) => {
                if (err) {
                  console.error('createOrIncrementTicket refetch error:', err.message);
                  return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(200).json({ ticket: updated, isDuplicate: true, aiAvailable: aiResult.aiAvailable });
              });
            }
          );
          return;
        }

        // No existing match — create a fresh ticket with the AI's own
        // classification and priority estimate baked in from the start.
        const priority = computePriority(aiResult.priority, 1);

        db.run(
          `INSERT INTO tickets
             (title, category, location, submitted_by, report_count, priority,
              ai_department, ai_confidence, ai_summary, ai_priority, status)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'pending')`,
          [title, category, location, submitted_by, priority,
           aiResult.department, aiResult.confidence, aiResult.summary, aiResult.priority],
          function (err) {
            if (err) {
              console.error('createOrIncrementTicket insert error:', err.message);
              return res.status(500).json({ error: 'Internal server error' });
            }

            const newId = this.lastID;
            const ticketId = `GRIEV-2026-${padTicketNumber(newId)}`;

            db.run('UPDATE tickets SET ticket_id = ? WHERE id = ?', [ticketId, newId], (err) => {
              if (err) {
                console.error('createOrIncrementTicket ticket_id update error:', err.message);
                return res.status(500).json({ error: 'Internal server error' });
              }
              db.get('SELECT * FROM tickets WHERE id = ?', [newId], (err, created) => {
                if (err) {
                  console.error('createOrIncrementTicket refetch error:', err.message);
                  return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(201).json({ ticket: created, isDuplicate: false, aiAvailable: aiResult.aiAvailable });
              });
            });
          }
        );
      }
    );
  } catch (err) {
    // Safety net: an unexpected throw (e.g. before the DB callbacks run)
    // must never leave the request hanging.
    console.error('createOrIncrementTicket unexpected error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------
// PUT /api/tickets/:ticketId
// Not currently called by the frontend (there's no admin "mark resolved"
// button wired up yet), but included so that feature is a one-line fetch
// away when you build it.
// Body: { status } — one of 'pending' | 'in_review' | 'resolved'
// ---------------------------------------------------------------------
function updateTicketStatus(req, res) {
  const { ticketId } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'in_review', 'resolved'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  db.run('UPDATE tickets SET status = ? WHERE ticket_id = ?', [status, ticketId], function (err) {
    if (err) {
      console.error('updateTicketStatus error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Status updated', ticketId, status });
  });
}

module.exports = {
  listTickets,
  listUserTickets,
  searchTickets,
  createOrIncrementTicket,
  updateTicketStatus,
};
