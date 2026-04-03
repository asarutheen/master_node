// PostgreSQL connection using the 'pg' library (node-postgres).
// We use a connection pool — not a single connection.
// The pool manages multiple connections automatically.

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Pool configuration
  max: 10, // maximum 10 connections in the pool
  idleTimeoutMillis: 30000, // close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // fail if can't connect within 2 seconds
});

// Test the connection when server starts
pool.on("connect", () => {
  console.log("[DB] New client connected to PostgreSQL.");
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err.message);
  process.exit(1); // fail fast — DB connection is critical
});

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log("[DB] PostgreSQL connected successfully.");
    client.release(); // release back to pool immediately after test
  } catch (err) {
    console.error("[DB] Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
}

module.exports = { pool, connectDB };
