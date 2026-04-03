const rateLimit = require("express-rate-limit");

// Different limiters for different routes.
// Each one is tuned to the sensitivity of the endpoint it protects.

// Login — strictest limit, primary brute force target
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE] Login rate limit hit from IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Try again in 15 minutes.",
    });
  },
});

// OTP verify — tight limit, prevent OTP brute force
// A 6 digit OTP has 1,000,000 combinations — without this
// an attacker could try all of them in seconds
const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE] OTP rate limit hit from IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: "Too many OTP attempts. Try again in 10 minutes.",
    });
  },
});

// Refresh token — moderate limit
// Legitimate clients refresh at most once every 15 mins
// Anything more is suspicious
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE] Refresh rate limit hit from IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: "Too many refresh attempts. Try again later.",
    });
  },
});

// General API — relaxed limit for normal routes
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Slow down.",
    });
  },
});

module.exports = {
  loginRateLimiter,
  otpRateLimiter,
  refreshRateLimiter,
  apiRateLimiter,
};
