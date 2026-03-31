// In-memory store for blacklisted refresh tokens.
// Phase 4+ will move this to Redis for persistence across server restarts
// and to work across multiple server instances.

const blacklist = new Set();

// Add a token to the blacklist on logout
function blacklistToken(token) {
  blacklist.add(token);
}

// Check if a token has been blacklisted
function isBlacklisted(token) {
  return blacklist.has(token);
}

module.exports = { blacklistToken, isBlacklisted };
