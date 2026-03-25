const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();

// routes/auth.js receives the users array injected from server.js
// This pattern makes it easy to swap in a DB later without touching route logic

module.exports = (users) => {
  // POST /api/auth/login
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // ── 1. Validate input ─────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // ── 2. Find user by email ─────────────────────────────────────────────────
    const user = users.find((u) => u.email === email.toLowerCase().trim());

    if (!user) {
      // Don't reveal whether the email exists — always say "invalid credentials"
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // ── 3. Compare password ───────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // ── 4. Login successful ───────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        // Never send the password back — not even the hash
      },
    });
  });

  return router;
};
