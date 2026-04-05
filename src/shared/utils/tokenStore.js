// Token blacklist backed by Redis.
// Replaces the in-memory Set from Phase 4.
//
// Why Redis over in-memory Set:
//
//   In-memory Set (old)           Redis (new)
//   ───────────────────           ───────────
//   Lost on server restart        Persists forever
//   Only works on 1 server        Works across all EC2 instances
//   Manual cleanup needed         TTL auto-expires tokens
//   Grows forever in memory       Bounded by token TTL

const { redis } = require("../../config/redis");

// Key prefix — keeps blacklist keys organised in Redis
// In Redis CLI: KEYS blacklist:* shows all blacklisted tokens
const PREFIX = "blacklist:";

// How long to keep a blacklisted token in Redis.
// No point keeping it longer than the refresh token TTL —
// an expired token is already invalid regardless of blacklist.
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ── Blacklist operations ──────────────────────────────────────────────────────

async function blacklistToken(token) {
  try {
    // SET key value EX seconds
    // Token auto-deletes from Redis after 7 days — no manual cleanup needed
    await redis.set(
      `${PREFIX}${token}`,
      "revoked",
      "EX",
      REFRESH_TOKEN_TTL_SECONDS,
    );
    console.log("[TOKENSTORE] Token blacklisted successfully.");
  } catch (err) {
    console.error(
      "[TOKENSTORE] Failed to blacklist token in Redis:",
      err.message,
    );
    // Fall back to in-memory blacklist if Redis is down
    inMemoryBlacklist.add(token);
  }
}

async function isBlacklisted(token) {
  try {
    const result = await redis.get(`${PREFIX}${token}`);
    // result is "revoked" if blacklisted, null if not found
    return result !== null;
  } catch (err) {
    console.error(
      "[TOKENSTORE] Failed to check blacklist in Redis:",
      err.message,
    );
    // Fall back to in-memory blacklist check
    return inMemoryBlacklist.has(token);
  }
}

// ── Refresh token rotation ────────────────────────────────────────────────────
// Stores active refresh tokens per user.
// Enables reuse detection and all-device logout.

const ACTIVE_PREFIX = "refresh:";

async function storeRefreshToken(userId, token) {
  try {
    // Store as a Redis Set per user — one user can have multiple active tokens
    // (logged in on multiple devices)
    //
    // AWS view: This is like a DynamoDB Set attribute —
    //           one item (userId) with a set of values (tokens)
    await redis.sadd(`${ACTIVE_PREFIX}${userId}`, token);

    // Set TTL on the set — auto expires after 7 days
    await redis.expire(`${ACTIVE_PREFIX}${userId}`, REFRESH_TOKEN_TTL_SECONDS);

    console.log(`[TOKENSTORE] Refresh token stored for user ${userId}.`);
  } catch (err) {
    console.error("[TOKENSTORE] Failed to store refresh token:", err.message);
  }
}

async function isRefreshTokenActive(userId, token) {
  try {
    // SISMEMBER checks if token exists in the user's set
    // O(1) — instant regardless of how many tokens the user has
    const exists = await redis.sismember(`${ACTIVE_PREFIX}${userId}`, token);
    return exists === 1;
  } catch (err) {
    console.error("[TOKENSTORE] Failed to check refresh token:", err.message);
    return true; // fail open — don't lock out user if Redis is down
  }
}

async function removeRefreshToken(userId, token) {
  try {
    // Remove specific token — single device logout
    await redis.srem(`${ACTIVE_PREFIX}${userId}`, token);
  } catch (err) {
    console.error("[TOKENSTORE] Failed to remove refresh token:", err.message);
  }
}

async function removeAllRefreshTokens(userId) {
  try {
    // Remove entire set — all device logout
    // Used when:
    //   - password changed
    //   - account suspended
    //   - token reuse detected (theft)
    //   - admin forced logout
    await redis.del(`${ACTIVE_PREFIX}${userId}`);
    console.log(`[TOKENSTORE] All refresh tokens removed for user ${userId}.`);
  } catch (err) {
    console.error(
      "[TOKENSTORE] Failed to remove all refresh tokens:",
      err.message,
    );
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────
// Used when Redis is down — degraded mode.
// Not persistent, not shared across instances —
// but better than nothing.

const inMemoryBlacklist = new Set();

// ── Redis key visualisation ───────────────────────────────────────────────────
// This is what Redis looks like after a few logins/logouts:
//
// blacklist:eyJhbGci...   →  "revoked"         TTL: 604800s
// blacklist:eyJhbGci...   →  "revoked"         TTL: 431200s
// refresh:1               →  Set { "eyJ...", "eyK..." }  (Alice on 2 devices)
// refresh:2               →  Set { "eyL..." }            (Bob on 1 device)
//
// AWS ElastiCache view:
// Same structure — ElastiCache is Redis-compatible
// You can connect RedisInsight to ElastiCache to visualise this

module.exports = {
  blacklistToken,
  isBlacklisted,
  storeRefreshToken,
  isRefreshTokenActive,
  removeRefreshToken,
  removeAllRefreshTokens,
};
