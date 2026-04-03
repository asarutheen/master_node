// Token blacklist — stores revoked refresh tokens.
// Currently in-memory using a Set.
// Phase 6 Step 3 will replace this with Redis for two reasons:
//   1. Memory resets on server restart — blacklisted tokens become valid again
//   2. Doesn't work across multiple server instances — instance A's blacklist
//      is invisible to instance B

const blacklist = new Set();

// Add token to blacklist on logout
function blacklistToken(token) {
  blacklist.add(token);
}

// Check if token has been revoked
function isBlacklisted(token) {
  return blacklist.has(token);
}

// Returns blacklist size — useful for monitoring memory usage
function getBlacklistSize() {
  return blacklist.size;
}

// Cleanup — remove expired tokens from blacklist
// Called periodically so the Set doesn't grow forever
// In Redis this is handled automatically via TTL — no cleanup needed
function cleanup(tokens) {
  const jwt = require("jsonwebtoken");

  for (const token of blacklist) {
    try {
      jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      // token is still valid — keep it blacklisted
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // token is expired anyway — safe to remove from blacklist
        // an expired token can never be used regardless
        blacklist.delete(token);
      }
    }
  }

  console.log(`[TOKENSTORE] Cleanup done. Blacklist size: ${blacklist.size}`);
}

// Run cleanup every hour automatically
setInterval(cleanup, 60 * 60 * 1000);

module.exports = { blacklistToken, isBlacklisted, getBlacklistSize };
