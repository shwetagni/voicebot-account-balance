const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bank.sqlite');

let dbInstance = null;

/**
 * Returns a shared db wrapper: { get, all, run, exec }
 * Uses sql.js (compiled to WebAssembly) instead of better-sqlite3, so there
 * is NO native compilation step — this avoids needing Python / a C++
 * compiler on the machine running the server (a common pain point on
 * Windows).
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlDb = new SQL.Database();
  }

  function persist() {
    fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
  }

  function get(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);
    let row;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  function all(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
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

  dbInstance = { get, all, run, exec };
  return dbInstance;
}

module.exports = { getDb };
