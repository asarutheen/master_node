const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { blacklistToken, isBlacklisted } = require("../data/tokenStore");
const {
  recordFailedAttempt,
  isAccountLocked,
  getLockTimeRemaining,
  resetAttempts,
} = require("../data/loginAttempts");
const { log, EVENT } = require("../data/auditLog");
const { findUserById } = require("../data/users");

const router = express.Router();

module.exports = (findUserByEmail) => {
  // POST /auth/login
  router.post("/login", async (req, res) => {
    const { email, password, otp } = req.body;

    // Step 1 — validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Step 2 — check account lockout
    if (isAccountLocked(email)) {
      const minutes = getLockTimeRemaining(email);
      log(EVENT.LOGIN_LOCKED, email, req);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${minutes} minute(s).`,
      });
    }

    // Step 3 — find user
    const user = findUserByEmail(email);

    if (!user) {
      recordFailedAttempt(email);
      log(EVENT.LOGIN_FAILED, email, req, { reason: "user not found" });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 4 — verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      recordFailedAttempt(email);
      log(EVENT.LOGIN_FAILED, email, req, { reason: "wrong password" });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Step 5 — check 2FA if enabled
    if (user.twoFactorSecret) {
      if (!otp) {
        // Password was correct but no OTP provided
        // Tell the client 2FA is required — don't issue tokens yet
        return res.status(200).json({
          success: false,
          twoFactorRequired: true,
          message: "OTP required. Please enter your 2FA code.",
        });
      }

      // Verify the OTP against the user's secret
      const otpValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: otp,
        window: 1, // allow 1 step drift (30 sec) for clock skew
      });

      if (!otpValid) {
        recordFailedAttempt(email);
        log(EVENT.LOGIN_FAILED, email, req, { reason: "invalid otp" });
        return res.status(401).json({
          success: false,
          message: "Invalid OTP code.",
        });
      }
    }

    // Step 6 — all checks passed, reset failed attempts
    resetAttempts(email);
    log(EVENT.LOGIN_SUCCESS, email, req);

    // Step 7 — sign tokens
    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
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

      // Fresh user lookup — picks up any role or data changes
      const user = findUserById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User no longer exists.",
        });
      }

      const newAccessToken = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN },
      );

      log(EVENT.TOKEN_REFRESH, user.email, req);

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
    log(EVENT.LOGOUT, req.user?.email || "unknown", req);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });

  // POST /auth/2fa/setup
  // Generates a 2FA secret for the user — they scan it with Google Authenticator
  router.post("/2fa/setup", (req, res) => {
    const { email } = req.body;

    const user = findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Generate a new secret for this user
    const secret = speakeasy.generateSecret({
      name: `LoginService (${email})`,
    });

    // In production — save secret.base32 to the user's DB record here
    // For now we print it so you can test manually
    console.log(`2FA secret for ${email}:`, secret.base32);
    console.log(`Scan this URL in Google Authenticator:`, secret.otpauth_url);

    return res.status(200).json({
      success: true,
      message: "2FA secret generated. Save this secret.",
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  });

  return router;
};
