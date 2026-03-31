const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { blacklistToken, isBlacklisted } = require("../data/tokenStore");
const {
  recordFailedAttempt,
  isAccountLocked,
  getLockTimeRemaining,
  resetAttempts,
  getRemainingAttempts,
} = require("../data/loginAttempts");

const router = express.Router();

module.exports = (findUserByEmail, findUserById) => {
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

    // Step 2 — check if account is locked
    if (isAccountLocked(email)) {
      const minutes = getLockTimeRemaining(email);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${minutes} minute(s).`,
      });
    }

    // Step 3 — find user
    const user = findUserByEmail(email);

    if (!user) {
      // Still record the attempt even if user doesn't exist
      // Prevents attackers from knowing which emails are registered
      recordFailedAttempt(email);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 4 — verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      recordFailedAttempt(email);

      const remaining = getRemainingAttempts(email) || 0;
      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${remaining} attempt(s) remaining.`,
      });
    }
    // Step 5 — successful login, reset failed attempts
    resetAttempts(email);

    // Step 6 — sign tokens
    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    const refreshToken = jwt.sign(
      { id: user.id },
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
  router.post("/refresh", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required.",
      });
    }

    if (isBlacklisted(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked. Please log in again.",
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      console.log("Decoded refresh token:", decoded);
      const user = findUserById(decoded.id);
      console.log("User found for refresh token:", user);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found. Please log in again.",
        });
      }

      const newAccessToken = jwt.sign(
        { id: user.id, name: user.name, email: user.email },
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
  router.post("/logout", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required.",
      });
    }

    blacklistToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });

  return router;
};
