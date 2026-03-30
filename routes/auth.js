const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();

module.exports = (findUserByEmail) => {
  // POST /auth/login
  // Body: { email, password }
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // Step 1 — validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Step 2 — find user by email
    const user = findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 3 — compare password against stored hash
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 4 — success
    // Phase 2: we will return a JWT token here
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        // never send the password back — not even the hash
      },
    });
  });

  return router;
};
