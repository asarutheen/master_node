const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

module.exports = (findUserByEmail) => {
  // POST /auth/login
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // Step 1 — validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Step 2 — find user
    const user = findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 3 — verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 4 — sign a JWT token
    // We put only safe, non-sensitive info in the payload
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    // Step 5 — return the token
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
    });
  });

  return router;
};
