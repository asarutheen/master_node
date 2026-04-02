require("dotenv").config();

const express = require("express");
const { findUserByEmail, findUserById } = require("./data/users");
const authRoutes = require("./routes/auth");
const { verifyToken } = require("./middleware/auth");
const { authorize } = require("./middleware/authorize");
const { loginRateLimiter } = require("./middleware/rateLimiter");
const { getLogs } = require("./data/auditLog");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Rate limit login only
app.use("/auth/login", loginRateLimiter);

// Public routes
app.use("/auth", authRoutes(findUserByEmail));

// Protected — any logged in user
app.get("/profile", verifyToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "This is your profile.",
    user: req.user,
  });
});

app.get("/dashboard", verifyToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome to the dashboard.",
    user: req.user,
  });
});

// Protected — admin only
app.get("/admin", verifyToken, authorize("admin"), (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome, admin.",
    user: req.user,
  });
});

// Protected — admin only — view all audit logs
app.get("/admin/logs", verifyToken, authorize("admin"), (req, res) => {
  return res.status(200).json({
    success: true,
    logs: getLogs(),
  });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
