// Validates all required environment variables at startup.
// If anything is missing the server refuses to start — fail fast.
// Much better than crashing mid-request with "undefined" errors.

const required = [
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_SECRET",
  "JWT_REFRESH_EXPIRES_IN",
];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[ENV] Missing required environment variables:`);
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1); // hard stop — don't start the server
  }

  console.log("[ENV] All environment variables loaded successfully.");
}

module.exports = { validateEnv };
