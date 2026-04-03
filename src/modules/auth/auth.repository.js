// Repository layer — the ONLY place that talks to the database.
// No business logic here — just raw queries.
// When we swap PostgreSQL for another DB, only this file changes.

const { pool } = require("../../config/db");

// ── User queries ──────────────────────────────────────────────────────────────

async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, name, email, password, role, two_factor_secret, is_locked, lock_until
     FROM users
     WHERE email = $1`,
    [email.toLowerCase().trim()],
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, name, email, password, role, two_factor_secret, is_locked, lock_until
     FROM users
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] || null;
}

async function updateTwoFactorSecret(userId, secret) {
  await pool.query(
    `UPDATE users
     SET two_factor_secret = $1
     WHERE id = $2`,
    [secret, userId],
  );
}

// ── Failed attempt / lockout queries ─────────────────────────────────────────

async function getLoginAttempts(email) {
  const result = await pool.query(
    `SELECT failed_attempts, locked_until
     FROM login_attempts
     WHERE email = $1`,
    [email.toLowerCase().trim()],
  );

  return result.rows[0] || null;
}

async function recordFailedAttempt(email) {
  // Upsert — insert if not exists, update if exists
  await pool.query(
    `INSERT INTO login_attempts (email, failed_attempts, last_attempt)
     VALUES ($1, 1, NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       failed_attempts = login_attempts.failed_attempts + 1,
       last_attempt = NOW()`,
    [email.toLowerCase().trim()],
  );
}

async function lockAccount(email, lockUntil) {
  await pool.query(
    `UPDATE login_attempts
     SET locked_until = $1
     WHERE email = $2`,
    [lockUntil, email.toLowerCase().trim()],
  );
}

async function resetLoginAttempts(email) {
  await pool.query(
    `DELETE FROM login_attempts
     WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
}

// ── Audit log queries ─────────────────────────────────────────────────────────

async function insertAuditLog(event, email, ip, userAgent, metadata) {
  await pool.query(
    `INSERT INTO audit_logs (event, email, ip, user_agent, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [event, email, ip, userAgent, JSON.stringify(metadata)],
  );
}

async function getAuditLogs() {
  const result = await pool.query(
    `SELECT * FROM audit_logs
     ORDER BY created_at DESC
     LIMIT 100`,
  );

  return result.rows;
}

async function getAuditLogsByEmail(email) {
  const result = await pool.query(
    `SELECT * FROM audit_logs
     WHERE email = $1
     ORDER BY created_at DESC`,
    [email.toLowerCase().trim()],
  );

  return result.rows;
}

module.exports = {
  findUserByEmail,
  findUserById,
  updateTwoFactorSecret,
  getLoginAttempts,
  recordFailedAttempt,
  lockAccount,
  resetLoginAttempts,
  insertAuditLog,
  getAuditLogs,
  getAuditLogsByEmail,
};
