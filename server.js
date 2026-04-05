// Entry point — the only file that starts the server.
// Loads env first, validates it, connects to DB, then starts listening.
// Everything else is handled by app.js.

require("dotenv").config();

const { validateEnv } = require("./src/config/env");
const { connectDB } = require("./src/config/db");
const { connectRedis } = require("./src/config/redis");
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Step 1 — validate all env variables before anything else
  // If anything is missing, process.exit(1) fires here
  validateEnv();

  // Step 2 — connect to PostgreSQL
  // If DB is unreachable, process.exit(1) fires here
  await connectDB();

  // Step 3 — connect Redis (non-fatal if fails)
  await connectRedis();

  // Step 4 — start listening for requests
  // Only reached if env + DB are both healthy
  app.listen(PORT, () => {
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
    console.log(
      `[SERVER] Environment: ${process.env.NODE_ENV || "development"}`,
    );
  });
}

// Start the server
// If anything throws unexpectedly, catch it and exit cleanly
startServer().catch((err) => {
  console.error("[SERVER] Failed to start:", err.message);
  process.exit(1);
});
