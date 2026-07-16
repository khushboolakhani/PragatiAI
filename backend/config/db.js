const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'grievance.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database.sql');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at ${DB_PATH}`);
});

// Run schema.sql on startup. CREATE TABLE IF NOT EXISTS makes this safe
// to run every time the server boots — it won't wipe existing data.
function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // Strip full-line comments BEFORE splitting on ';' so a semicolon
  // inside a comment sentence can never be mistaken for a statement end.
  const withoutComments = schema
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  db.serialize(() => {
    statements.forEach((statement) => {
      db.run(statement + ';', (err) => {
        if (err) {
          console.error('Schema init error:', err.message, '\nStatement:', statement);
        }
      });
    });
  });
}

initSchema();

module.exports = db;
