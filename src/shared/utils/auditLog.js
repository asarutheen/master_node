// Audit log utility — records every auth event.
// Currently logs to console + memory.
// Phase 6 Step 2 will write these directly to PostgreSQL audit_logs table.

const { pool } = require("../../config/db");

const EVENT = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  LOGOUT: "LOGOUT",
  TOKEN_REFRESH: "TOKEN_REFRESH",
  OTP_FAILED: "OTP_FAILED",
  OTP_SUCCESS: "OTP_SUCCESS",
};

async function log(event, email, req, extra = {}) {
  const entry = {
    event,
    email,
    ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    timestamp: new Date().toISOString(),
    ...extra,
  };

  // Always log to console in development
  console.log(
    `[AUDIT] ${entry.timestamp} | ${event} | ${email} | IP: ${entry.ip}`,
  );

  // Write to PostgreSQL
  // When DB is not yet set up this fails silently — we never crash
  // the request just because audit logging failed
  try {
    await pool.query(
      `INSERT INTO audit_logs (event, email, ip, user_agent, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.event,
        entry.email,
        entry.ip,
        entry.userAgent,
        JSON.stringify(extra),
        entry.timestamp,
      ],
    );
  } catch (err) {
    // Log the error but never crash the request
    // Audit logging failure should never block a user from logging in
    console.error("[AUDIT] Failed to write to DB:", err.message);
  }
}

module.exports = { log, EVENT };
