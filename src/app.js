// Express app setup — middleware, routes, error handling.
// No business logic, no DB calls, no server.listen() here.
// server.js is the only place that starts the server.
// This separation makes it easy to test the app without starting a real server.

const express = require("express");
const authRoutes = require("./modules/auth/auth.routes");
const { verifyToken } = require("./shared/middleware/verifyToken");
const { authorize } = require("./shared/middleware/authorize");
const { apiRateLimiter } = require("./shared/middleware/rateLimiter");
const {
  getAuditLogs,
  getAuditLogsByEmail,
} = require("./modules/auth/auth.repository");

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────

// Parse incoming JSON bodies
app.use(express.json());

// Apply general rate limit to all routes
app.use(apiRateLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth — public + protected auth endpoints
app.use("/auth", authRoutes);

// Health check — no auth needed
// Load balancers and monitoring tools ping this to check if server is alive
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Profile — any logged in user
app.get(
  "/profile",
  verifyToken,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "This is your profile.",
      user: req.user,
    });
  }),
);

// Dashboard — any logged in user
app.get(
  "/dashboard",
  verifyToken,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Welcome to the dashboard.",
      user: req.user,
    });
  }),
);

// Admin panel — admin only
app.get(
  "/admin",
  verifyToken,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Welcome, admin.",
      user: req.user,
    });
  }),
);

// Audit logs — admin only
app.get(
  "/admin/logs",
  verifyToken,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const { email } = req.query;
    const logs = email
      ? await getAuditLogsByEmail(email)
      : await getAuditLogs();

    return res.status(200).json({
      success: true,
      logs,
    });
  }),
);

// ── Global error handler ──────────────────────────────────────────────────────

// Catches any unhandled errors thrown inside route handlers
// Without this, Express just sends a blank 500 response
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  console.error(err.stack);

  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again later.",
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

module.exports = app;
