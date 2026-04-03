const express = require("express");
const {
  handleLoginStep1,
  handleLoginStep2,
  handleRefresh,
  handleLogout,
  handle2FASetup,
} = require("./auth.controller");
const { verifyToken } = require("../../shared/middleware/verifyToken");
const {
  loginRateLimiter,
  otpRateLimiter,
  refreshRateLimiter,
} = require("../../shared/middleware/rateLimiter");
const { asyncHandler } = require("../../shared/utils/asyncHandler");

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/login", loginRateLimiter, asyncHandler(handleLoginStep1));
router.post("/verify-otp", otpRateLimiter, asyncHandler(handleLoginStep2));
router.post("/refresh", refreshRateLimiter, asyncHandler(handleRefresh));

// ── Protected routes ──────────────────────────────────────────────────────────
router.post("/logout", verifyToken, asyncHandler(handleLogout));
router.post("/2fa/setup", verifyToken, asyncHandler(handle2FASetup));

module.exports = router;
