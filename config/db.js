const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const client = (process.env.DB_CLIENT || "sqlite").toLowerCase();

let db;
let pgPool;

if (client === "postgres") {
  const { Pool } = require("pg");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
} else {
  const dbPath = path.resolve(process.env.SQLITE_PATH || "./marketplace.db");
  db = new sqlite3.Database(dbPath);
  db.configure("busyTimeout", 5000);
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA journal_mode = WAL");
}

function normalize(sql) {
  if (client !== "postgres") return sql;
  return sql.replace(/\?/g, () => `$${++normalize.counter}`);
}
normalize.counter = 0;

async function query(sql, params = []) {
  if (client === "postgres") {
    normalize.counter = 0;
    return pgPool.query(normalize(sql), params);
  }

  return new Promise((resolve, reject) => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT") || trimmed.startsWith("WITH") || trimmed.startsWith("PRAGMA")) {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve({ rows }));
    } else {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ rows: [], lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

async function transaction(callback) {
  if (client === "postgres") {
    const conn = await pgPool.connect();
    try {
      await conn.query("BEGIN");
      const result = await callback({
        query: (sql, params = []) => {
          normalize.counter = 0;
          return conn.query(normalize(sql), params);
        }
      });
      await conn.query("COMMIT");
      return result;
    } catch (err) {
      await conn.query("ROLLBACK");
      throw err;
    } finally {
      conn.release();
    }
  }

  await query("BEGIN TRANSACTION");
  try {
    const result = await callback({ query });
    await query("COMMIT");
    return result;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

async function close() {
  if (pgPool) await pgPool.end();
  if (db) await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
}

module.exports = { query, transaction, close, client };
