const db = require('../config/db');
const { analyzeComplaint } = require('../config/aiService');

// Mirrors computePriority() in the frontend's src/types.ts exactly —
// keep these in sync if that function ever changes.
function computePriority(reportCount) {
  if (reportCount >= 3) return 'Critical';
  if (reportCount === 2) return 'High';
  return 'Low';
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
// Body: { title, category, location, submitted_by }
//
// Dedup logic (matches frontend's old createTicketOrIncrement exactly):
//   - If a ticket already exists with the same category + location,
//     increment its report_count and recompute priority instead of
//     creating a new row.
//   - Otherwise, create a new ticket, generate a ticket_id, and call
//     the AI service (informational — doesn't affect priority or category).
//
// Response shape: { ticket, isDuplicate } — matches the frontend's
// SubmitResult interface so api.ts can be a near-drop-in replacement.
// ---------------------------------------------------------------------
function createOrIncrementTicket(req, res) {
  const { title, category, location, submitted_by } = req.body;

  if (!title || !category || !location || !submitted_by) {
    return res.status(400).json({ error: 'title, category, location, and submitted_by are all required' });
  }

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
        const newPriority = computePriority(newCount);

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
              res.status(200).json({ ticket: updated, isDuplicate: true });
            });
          }
        );
        return;
      }

      // No existing match — create a fresh ticket.
      const priority = computePriority(1);

      db.run(
        `INSERT INTO tickets (title, category, location, submitted_by, report_count, priority, status)
         VALUES (?, ?, ?, ?, 1, ?, 'pending')`,
        [title, category, location, submitted_by, priority],
        async function (err) {
          if (err) {
            console.error('createOrIncrementTicket insert error:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
          }

          const newId = this.lastID;
          const ticketId = `GRIEV-2026-${padTicketNumber(newId)}`;

          // Fire the AI classification. It's informational only, so a
          // failure here must never block ticket creation.
          const aiResult = await analyzeComplaint(title);

          db.run(
            'UPDATE tickets SET ticket_id = ?, ai_department = ?, ai_confidence = ?, ai_summary = ? WHERE id = ?',
            [ticketId, aiResult.department, aiResult.confidence, aiResult.summary, newId],
            (err) => {
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
            }
          );
        }
      );
    }
  );
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
