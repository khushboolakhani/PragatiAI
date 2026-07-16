require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ticketRoutes = require('./routes/ticketRoutes');

// Initializes the DB connection and runs the schema — must happen
// before routes are hit.
require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS ---
// Vite's default dev server runs on 5173. Add your Bolt/Replit preview
// URL (and later your production frontend URL) to ALLOWED_ORIGINS in .env.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json());

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'grievance-backend', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api', ticketRoutes);

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

app.listen(PORT, () => {
  console.log(`Grievance backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
