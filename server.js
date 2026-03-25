const express = require("express");
const { findUserByEmail } = require("./data/users");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = 3000;

// Middleware — parse incoming JSON request bodies
app.use(express.json());

// Pass findUserByEmail into the auth router
app.use("/auth", authRoutes(findUserByEmail));

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
