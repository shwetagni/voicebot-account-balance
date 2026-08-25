const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bank.sqlite');

let dbInstance = null;

function getAccountCount(sqlDb) {
  const result = sqlDb.exec('SELECT COUNT(*) AS count FROM accounts');

  if (!result.length || !result[0].values.length) {
    return 0;
  }

  return result[0].values[0][0];
}

async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  let sqlDb;

  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlDb = new SQL.Database();
  }

  // Create tables
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      balance REAL NOT NULL,
      email TEXT,
      phone TEXT,
      card_number TEXT,
      card_status TEXT DEFAULT 'ACTIVE',
      ticket_number TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,
      authenticated_at TEXT NOT NULL
    );
  `);

  // Seed accounts if database is empty
  if (getAccountCount(sqlDb) === 0) {
    sqlDb.run(`
      INSERT INTO accounts
        (account_number, name, pin, balance, email, phone, card_number, card_status)
      VALUES
        ('1001', 'Asha Rao', '1234', 125430.5, 'asha@example.com', '9000000001', '4111111111111111', 'ACTIVE'),
        ('1002', 'Rahul Mehta', '1122', 8420, 'shwetagnikarad@gmail.com', '9000000002', '4222222222222222', 'ACTIVE'),
        ('1003', 'Priya Nair', '3344', 998765.1, 'priya@example.com', '9000000003', '4333333333333333', 'ACTIVE')
    `);
  }

  function persist() {
    fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
  }

  function get(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);

    let row;

    if (stmt.step()) {
      row = stmt.getAsObject();
    }

    stmt.free();
    return row;
  }

  function all(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);

    const rows = [];

    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }

    stmt.free();
    return rows;
  }

  function run(sql, params = []) {
    sqlDb.run(sql, params);
    persist();
  }

  function exec(sql) {
    sqlDb.run(sql);
    persist();
  }

  // Save database after table creation/seed
  persist();

  dbInstance = {
    get,
    all,
    run,
    exec
  };

  console.log('Database ready:', DB_PATH);

  return dbInstance;
}

module.exports = { getDb };

