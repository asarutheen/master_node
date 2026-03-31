require("dotenv").config();

const express = require("express");
const { findUserByEmail } = require("./data/users");
const authRoutes = require("./routes/auth");
const { verifyToken } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Public routes
app.use("/auth", authRoutes(findUserByEmail));

// Protected routes
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
