// Audit log — records every login attempt with outcome, IP, and timestamp.
// In Phase 6 this will be a PostgreSQL table so logs persist forever.
// Security teams use this to detect patterns — brute force, credential stuffing etc.

const logs = [];

const EVENT = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  LOGOUT: "LOGOUT",
  TOKEN_REFRESH: "TOKEN_REFRESH",
};

function log(event, email, req, extra = {}) {
  const entry = {
    event,
    email,
    ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    timestamp: new Date().toISOString(),
    ...extra,
  };

  logs.push(entry);

  // Print to console so we can see it in terminal during development
  console.log(
    `[AUDIT] ${entry.timestamp} | ${event} | ${email} | IP: ${entry.ip}`,
  );
}

// Returns all logs — admin dashboard will use this in Phase 6
function getLogs() {
  return logs;
}

// Returns logs filtered by email — useful for investigating specific accounts
function getLogsByEmail(email) {
  return logs.filter((l) => l.email === email);
}

module.exports = { log, getLogs, getLogsByEmail, EVENT };
