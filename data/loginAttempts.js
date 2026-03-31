// Tracks failed login attempts per email address.
// Phase 6 will move this to Redis for persistence and multi-server support.

const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// Structure stored per email:
// {
//   count: number        — how many consecutive failed attempts
//   lockedUntil: Date    — when the lock expires (null if not locked)
// }
const attempts = new Map();

// Call this on every failed login attempt
function recordFailedAttempt(email) {
  const now = Date.now();
  const record = attempts.get(email) || { count: 0, lockedUntil: null };

  // If a previous lock has expired, reset the record fresh
  if (record.lockedUntil && now > record.lockedUntil) {
    attempts.set(email, { count: 1, lockedUntil: null });
    return;
  }

  record.count += 1;

  // If they've hit the max, lock the account
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCK_TIME_MS;
  }

  attempts.set(email, record);
}

// Call this on every login attempt before checking password
function isAccountLocked(email) {
  const now = Date.now();
  const record = attempts.get(email);

  if (!record || !record.lockedUntil) return false;

  // Lock has expired — auto unlock
  if (now > record.lockedUntil) {
    attempts.delete(email);
    return false;
  }

  return true;
}

// Returns how many minutes remain on the lock
function getLockTimeRemaining(email) {
  const record = attempts.get(email);
  if (!record || !record.lockedUntil) return 0;

  const remaining = record.lockedUntil - Date.now();
  return Math.ceil(remaining / 1000 / 60); // convert ms to minutes, round up
}

// Call this on successful login — reset the counter
function resetAttempts(email) {
  attempts.delete(email);
}

// Return how many attempts remain before lockout (for user feedback)
function getRemainingAttempts(email) {
  const record = attempts.get(email);
  if (!record) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - record.count);
}

module.exports = {
  recordFailedAttempt,
  isAccountLocked,
  getLockTimeRemaining,
  resetAttempts,
  getRemainingAttempts,
};
