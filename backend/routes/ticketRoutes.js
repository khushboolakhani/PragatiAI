const express = require('express');
const router = express.Router();
const {
  listTickets,
  listUserTickets,
  searchTickets,
  createOrIncrementTicket,
  updateTicketStatus,
  escalateStaleTickets,   // NEW
  listReminders,          // NEW
} = require('../controllers/ticketController');

// IMPORTANT: order matters here. Express matches routes top to bottom,
// and /user and /search must come BEFORE /:ticketId-style routes so
// they aren't swallowed as if "user" or "search" were a ticket ID.

// GET /api/tickets/user?email=...   -> a citizen's own ticket history
router.get('/tickets/user', listUserTickets);

// GET /api/tickets/search?q=...     -> search across title/category/location
router.get('/tickets/search', searchTickets);

// GET /api/tickets                  -> all tickets (admin dashboard + public list)
router.get('/tickets', listTickets);

// POST /api/tickets                 -> submit a complaint (dedup + AI classification)
router.post('/tickets', createOrIncrementTicket);

// PUT /api/tickets/:ticketId        -> update status (not yet called by frontend)
router.put('/tickets/:ticketId', updateTicketStatus);

// POST /api/tickets/escalate  -> manually trigger the staleness check (also called by the scheduler in server.js)
router.post('/tickets/escalate', escalateStaleTickets);

// GET /api/reminders          -> recent department reminder notices
router.get('/reminders', listReminders);
module.exports = router;
