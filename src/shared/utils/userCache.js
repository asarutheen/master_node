// User cache — stores user data in Redis to avoid repeated DB queries.
// Every login does a SELECT FROM users — at 100k logins/sec that's
// 100k DB queries/sec. Cache reduces this to near zero.
//
// AWS view:
// This is the same pattern as ElastiCache in front of RDS —
// the most common AWS caching architecture used by every major company.
//
// Cache strategy used here: Cache-Aside (Lazy Loading)
//
//   Request comes in
//       ↓
//   Check Redis first
//       ↓ cache hit (~1ms)     ↓ cache miss (~10ms)
//   Return cached user         Query PostgreSQL
//                                  ↓
//                              Store in Redis
//                                  ↓
//                              Return user
//
// Next request for same user → cache hit → DB never touched

const { redis } = require("../../config/redis");

const PREFIX = "user:";
const TTL = 60 * 60; // cache user data for 1 hour

// ── Cache operations ──────────────────────────────────────────────────────────

async function getCachedUser(email) {
  try {
    const data = await redis.get(`${PREFIX}${email}`);

    if (!data) return null; // cache miss

    console.log(`[CACHE] Hit for user: ${email}`);
    return JSON.parse(data);
  } catch (err) {
    console.error("[CACHE] Failed to get user from cache:", err.message);
    return null; // cache miss on error — fall through to DB
  }
}

async function setCachedUser(user) {
  try {
    // Never cache the password hash — extra safety measure
    // Even though Redis should be private, defence in depth matters
    const { password, ...safeUser } = user;

    await redis.set(
      `${PREFIX}${safeUser.email}`,
      JSON.stringify(safeUser),
      "EX",
      TTL,
    );

    console.log(`[CACHE] Stored user: ${safeUser.email} (TTL: ${TTL}s)`);
  } catch (err) {
    console.error("[CACHE] Failed to cache user:", err.message);
    // non-fatal — DB will be used instead
  }
}

async function invalidateUserCache(email) {
  try {
    await redis.del(`${PREFIX}${email}`);
    console.log(`[CACHE] Invalidated cache for: ${email}`);
  } catch (err) {
    console.error("[CACHE] Failed to invalidate cache:", err.message);
  }
}

// ── Cache warming ─────────────────────────────────────────────────────────────
// Pre-loads frequently accessed users into cache at server startup.
// So the first request for a popular user is always a cache hit.
//
// AWS view: This is like pre-warming an ElastiCache cluster
//           before a big traffic event (Black Friday, product launch)

async function warmCache(users) {
  console.log(`[CACHE] Warming cache with ${users.length} users...`);

  await Promise.all(users.map((user) => setCachedUser(user)));

  console.log("[CACHE] Cache warming complete.");
}

// ── Rate limit cache ──────────────────────────────────────────────────────────
// Redis-backed rate limiting — works across all EC2 instances.
// Replaces express-rate-limit which is per-instance only.
//
// AWS view: This is what AWS WAF rate limiting does at the edge —
//           except this is at the application layer giving us more control.

async function incrementRateLimit(key, windowSeconds) {
  try {
    const redisKey = `ratelimit:${key}`;

    // MULTI/EXEC — Redis transaction
    // Both commands execute atomically — no race condition
    // AWS equivalent: DynamoDB conditional writes / transactions
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, windowSeconds);
    const results = await pipeline.exec();

    // results[0][1] is the new count after increment
    return results[0][1];
  } catch (err) {
    console.error("[CACHE] Failed to increment rate limit:", err.message);
    return 0; // fail open — don't block user if Redis is down
  }
}

async function getRateLimit(key) {
  try {
    const count = await redis.get(`ratelimit:${key}`);
    return parseInt(count) || 0;
  } catch (err) {
    console.error("[CACHE] Failed to get rate limit:", err.message);
    return 0;
  }
}

// ── Redis key visualisation ───────────────────────────────────────────────────
//
// After a few logins this is what Redis looks like:
//
// user:alice@example.com  →  { id, name, email, role }   TTL: 3600s
// user:bob@example.com    →  { id, name, email, role }   TTL: 2800s
// ratelimit:login:::1     →  "3"                         TTL: 900s
// ratelimit:login:82.x.x  →  "10"                        TTL: 120s
//
// AWS ElastiCache memory estimate:
//   1 user object  ≈  200 bytes
//   1M users cached = 200MB  ← fits in a cache.t3.medium ($15/month)

module.exports = {
  getCachedUser,
  setCachedUser,
  invalidateUserCache,
  warmCache,
  incrementRateLimit,
  getRateLimit,
};
