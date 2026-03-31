const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { blacklistToken, isBlacklisted } = require("../data/tokenStore");

const router = express.Router();

module.exports = (findUserByEmail) => {
  // POST /auth/login
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Sign a short-lived access token (15 mins)
    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    // Sign a long-lived refresh token (7 days)
    // Only contains the user id — minimal payload
    const refreshToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken,
      refreshToken,
    });
  });

  // POST /auth/refresh
  // Client sends refresh token → gets a new access token
  router.post("/refresh", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required.",
      });
    }

    // Step 1 — check if this token was blacklisted (logged out)
    if (isBlacklisted(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked. Please log in again.",
      });
    }

    // Step 2 — verify the refresh token
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Step 3 — find the user and issue a new access token
      const user = findUserByEmail(decoded.email) || {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
      };

      const newAccessToken = jwt.sign(
        { id: decoded.id, name: decoded.name, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN },
      );

      return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Refresh token expired. Please log in again.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid refresh token.",
      });
    }
  });

  // POST /auth/logout
  // Blacklists the refresh token — access token expires naturally
  router.post("/logout", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required.",
      });
    }

    // Add to blacklist — this token can never be used again
    blacklistToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });

  return router;
};
