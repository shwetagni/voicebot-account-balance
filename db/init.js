const { getDb } = require('./connection');

//new
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbDir = path.join(__dirname);
fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, "bank.sqlite");

const db = new sqlite3.Database(dbPath);
//new
















async function main() {
  const db = await getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      account_number TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      pin            TEXT NOT NULL,
      balance        REAL NOT NULL,
      card_status    TEXT NOT NULL DEFAULT 'active',
      phone          TEXT,
      email          TEXT
    );

    CREATE TABLE IF NOT EXISTS tickets (
      ticket_number   TEXT PRIMARY KEY,
      account_number  TEXT NOT NULL,
      type            TEXT NOT NULL,
      reason          TEXT,
      status          TEXT NOT NULL DEFAULT 'open',
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id       TEXT PRIMARY KEY,
      account_number   TEXT NOT NULL,
      authenticated_at TEXT NOT NULL
    );
  `);

  const seedOne = (account_number, name, pin, balance, phone, email) => {
    const existing = db.get('SELECT account_number FROM accounts WHERE account_number = ?', [account_number]);
    if (!existing) {
      db.run(
        'INSERT INTO accounts (account_number, name, pin, balance, card_status, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [account_number, name, pin, balance, 'active', phone, email]
      );
    }
  };

  seedOne('1001', 'Asha Rao', '4321', 125430.50, '+919900011001', 'asha.demo@example.com');
  seedOne('1002', 'Rahul Mehta', '1122', 8420.00, '+919900011002', 'rahul.demo@example.com');
  seedOne('1003', 'Priya Nair', '7788', 998765.10, '+919900011003', 'priya.demo@example.com');

  console.log('DB initialized and seeded at db/bank.sqlite');
  console.log(db.all('SELECT account_number, name, balance FROM accounts'));
}

main().catch((err) => {
  console.error('DB init failed:', err);
  process.exit(1);
});
