// Redis connection using ioredis.
// Locally → connects to redis://localhost:6379
// AWS     → connects to ElastiCache endpoint (same code, different .env)

const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    // Reconnect after:
    // attempt 1 → wait 100ms
    // attempt 2 → wait 200ms
    // attempt 3 → wait 400ms ... up to 10 seconds max
    const delay = Math.min(times * 100, 10000);
    console.warn(
      `[REDIS] Reconnecting... attempt ${times}, waiting ${delay}ms`,
    );
    return delay;
  },
  maxRetriesPerRequest: 3, // fail fast on individual commands
});

redis.on("connect", () => {
  console.log("[REDIS] Connected successfully.");
});

redis.on("ready", () => {
  console.log("[REDIS] Ready to accept commands.");
});

redis.on("error", (err) => {
  console.error("[REDIS] Connection error:", err.message);
  // don't process.exit here — Redis going down shouldn't crash the server
  // circuit breaker in each service handles degradation gracefully
});

redis.on("close", () => {
  console.warn("[REDIS] Connection closed.");
});

async function connectRedis() {
  try {
    await redis.ping();
    console.log("[REDIS] Ping successful.");
  } catch (err) {
    console.error("[REDIS] Failed to ping:", err.message);
    // non-fatal — app can run without Redis in degraded mode
    // token blacklist falls back to in-memory
    // rate limiting falls back to express-rate-limit
    // user cache falls back to DB queries
  }
}

module.exports = { redis, connectRedis };
