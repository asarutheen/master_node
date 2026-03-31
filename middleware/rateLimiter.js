const rateLimit = require("express-rate-limit");

// Applies only to /auth/login
// Limits each IP to 10 requests per 15 minutes
// This runs BEFORE the account lockout check — first line of defence

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 10, // max 10 attempts per IP per window
  standardHeaders: true, // sends RateLimit headers in response
  legacyHeaders: false,

  // Custom response when limit is hit
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many login attempts from this IP. Try again in 15 minutes.",
    });
  },
});

module.exports = { loginRateLimiter };
