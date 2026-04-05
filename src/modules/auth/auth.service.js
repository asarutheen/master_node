// Service layer — full Redis integration.
// Added:
//   - Cache-aside user lookup
//   - Refresh token storage in Redis
//   - Refresh token rotation
//   - Reuse detection (token theft detection)
//   - All-device logout

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");

const { log, EVENT } = require("../../shared/utils/auditLog");
const {
  blacklistToken,
  isBlacklisted,
  storeRefreshToken,
  isRefreshTokenActive,
  removeRefreshToken,
  removeAllRefreshTokens,
} = require("../../shared/utils/tokenStore");
const {
  getCachedUser,
  setCachedUser,
  invalidateUserCache,
} = require("../../shared/utils/userCache");
const {
  findUserByEmail,
  findUserById,
  updateTwoFactorSecret,
  recordFailedAttempt,
  resetLoginAttempts,
} = require("./auth.repository");

const { redis } = require("../../config/redis");

// ── Token helpers ─────────────────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );
}

function signRefreshToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
}

function signTempToken(user) {
  return jwt.sign(
    { id: user.id, step: "awaiting_otp" },
    process.env.JWT_SECRET,
    { expiresIn: "2m" },
  );
}

// ── User lookup with cache ────────────────────────────────────────────────────

async function getUser(email) {
  // Check Redis first
  let user = await getCachedUser(email);

  if (!user) {
    // Cache miss — go to PostgreSQL
    user = await findUserByEmail(email);

    if (user) {
      // Store in Redis for next time
      await setCachedUser(user);
    }
  }

  return user;
}

// ── Lockout helpers (Redis backed) ───────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCK_TIME_S = 15 * 60; // 15 minutes in seconds
const ATTEMPT_TTL_S = 15 * 60; // reset counter after 15 min of no attempts

const LOCKOUT_PREFIX = "lockout:";
const ATTEMPTS_PREFIX = "attempts:";

async function checkLockout(email) {
  try {
    const lockedUntil = await redis.get(`${LOCKOUT_PREFIX}${email}`);

    if (!lockedUntil) return { locked: false };

    const remaining = Math.ceil(
      (new Date(lockedUntil) - Date.now()) / 1000 / 60,
    );

    if (remaining <= 0) {
      // Lock expired — clean up
      await redis.del(`${LOCKOUT_PREFIX}${email}`);
      await redis.del(`${ATTEMPTS_PREFIX}${email}`);
      return { locked: false };
    }

    return { locked: true, remaining };
  } catch (err) {
    console.error("[LOCKOUT] Redis error:", err.message);
    // Redis down — fail open, don't block users
    return { locked: false };
  }
}

async function handleFailedAttempt(email) {
  try {
    const attemptsKey = `${ATTEMPTS_PREFIX}${email}`;
    const lockoutKey = `${LOCKOUT_PREFIX}${email}`;

    // Increment attempt counter
    // If key doesn't exist Redis creates it starting at 1
    const attempts = await redis.incr(attemptsKey);

    // Set TTL on counter — auto resets after 15 mins of no attempts
    await redis.expire(attemptsKey, ATTEMPT_TTL_S);

    console.log(
      `[LOCKOUT] Failed attempt ${attempts}/${MAX_ATTEMPTS} for ${email}`,
    );

    if (attempts >= MAX_ATTEMPTS) {
      // Lock the account
      const lockedUntil = new Date(
        Date.now() + LOCK_TIME_S * 1000,
      ).toISOString();

      await redis.set(lockoutKey, lockedUntil, "EX", LOCK_TIME_S);

      console.warn(`[LOCKOUT] Account locked: ${email} until ${lockedUntil}`);

      await log(
        EVENT.LOGIN_LOCKED,
        email,
        {},
        {
          attempts,
          lockedUntil,
        },
      );
    }
  } catch (err) {
    console.error("[LOCKOUT] Redis error:", err.message);
    // Redis down — fall back to PostgreSQL
    await recordFailedAttempt(email);
  }
}

async function resetAttempts(email) {
  try {
    await redis.del(`${ATTEMPTS_PREFIX}${email}`);
    await redis.del(`${LOCKOUT_PREFIX}${email}`);
  } catch (err) {
    console.error("[LOCKOUT] Failed to reset attempts:", err.message);
    await resetLoginAttempts(email);
  }
}

// ── Auth operations ───────────────────────────────────────────────────────────

async function loginStep1(email, password, req) {
  // Step 1 — check lockout
  const lockout = await checkLockout(email);

  if (lockout.locked) {
    await log(EVENT.LOGIN_LOCKED, email, req);
    return {
      success: false,
      status: 423,
      message: `Account locked. Try again in ${lockout.remaining} minute(s).`,
    };
  }

  // Step 2 — find user (cache-aside)
  const user = await getUser(email);

  if (!user) {
    await handleFailedAttempt(email);
    await log(EVENT.LOGIN_FAILED, email, req, { reason: "user not found" });
    return {
      success: false,
      status: 401,
      message: "Invalid email or password.",
    };
  }

  // Step 3 — verify password
  // bcrypt.compare needs the real hash — fetch from DB if cache hit
  // (cache never stores password — defence in depth)
  let userWithPassword = user.password ? user : await findUserByEmail(email);

  const passwordMatch = await bcrypt.compare(
    password,
    userWithPassword.password,
  );

  if (!passwordMatch) {
    await handleFailedAttempt(email);
    await log(EVENT.LOGIN_FAILED, email, req, { reason: "wrong password" });
    return {
      success: false,
      status: 401,
      message: "Invalid email or password.",
    };
  }

  // Step 4 — 2FA check
  if (userWithPassword.two_factor_secret) {
    const tempToken = signTempToken(userWithPassword);
    return {
      success: true,
      twoFactorRequired: true,
      tempToken,
      message: "Password verified. OTP required.",
    };
  }

  // Step 5 — all checks passed
  await resetLoginAttempts(email);
  await log(EVENT.LOGIN_SUCCESS, email, req);

  const accessToken = signAccessToken(userWithPassword);
  const refreshToken = signRefreshToken(userWithPassword);

  // Store refresh token in Redis — enables multi-device tracking
  await storeRefreshToken(userWithPassword.id, refreshToken);

  return {
    success: true,
    message: "Login successful.",
    accessToken,
    refreshToken,
  };
}

async function loginStep2(tempToken, otp, req) {
  // Step 1 — verify temp token
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch (err) {
    return {
      success: false,
      status: 401,
      message: "Invalid or expired temp token. Please log in again.",
    };
  }

  // Step 2 — confirm it is a temp token
  if (decoded.step !== "awaiting_otp") {
    return {
      success: false,
      status: 401,
      message: "Invalid token type.",
    };
  }

  // Step 3 — fresh user lookup from DB (always — never cache for 2FA)
  const user = await findUserById(decoded.id);

  if (!user) {
    return {
      success: false,
      status: 401,
      message: "User not found.",
    };
  }

  // Step 4 — verify OTP
  const otpValid = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: "base32",
    token: otp,
    window: 1,
  });

  if (!otpValid) {
    await handleFailedAttempt(user.email);
    await log(EVENT.OTP_FAILED, user.email, req);
    return {
      success: false,
      status: 401,
      message: "Invalid OTP code.",
    };
  }

  // Step 5 — all checks passed
  await resetLoginAttempts(user.email);
  await log(EVENT.OTP_SUCCESS, user.email, req);
  await log(EVENT.LOGIN_SUCCESS, user.email, req);

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // Store refresh token in Redis
  await storeRefreshToken(user.id, refreshToken);

  return {
    success: true,
    message: "Login successful.",
    accessToken,
    refreshToken,
  };
}

async function refresh(refreshToken, req) {
  // Step 1 — check blacklist
  if (await isBlacklisted(refreshToken)) {
    return {
      success: false,
      status: 401,
      message: "Refresh token revoked. Please log in again.",
    };
  }

  // Step 2 — verify token signature
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return {
        success: false,
        status: 401,
        message: "Refresh token expired. Please log in again.",
      };
    }
    return {
      success: false,
      status: 401,
      message: "Invalid refresh token.",
    };
  }

  // Step 3 — reuse detection
  // Check if this token is still active in Redis
  // If not — it was already rotated — possible theft
  const isActive = await isRefreshTokenActive(decoded.id, refreshToken);

  if (!isActive) {
    // Token was already rotated — this is suspicious
    // Could mean the token was stolen and used by an attacker first
    console.error(
      `[SECURITY] Refresh token reuse detected for user ${decoded.id}.` +
        ` Revoking all sessions.`,
    );

    // Nuclear option — logout from ALL devices
    await removeAllRefreshTokens(decoded.id);

    await log(EVENT.LOGIN_FAILED, `user:${decoded.id}`, req, {
      reason: "refresh token reuse detected — possible theft",
    });

    return {
      success: false,
      status: 401,
      message:
        "Security alert. All sessions have been revoked. Please log in again.",
    };
  }

  // Step 4 — fresh user lookup
  const user = await findUserById(decoded.id);

  if (!user) {
    return {
      success: false,
      status: 401,
      message: "User no longer exists.",
    };
  }

  // Step 5 — rotate the refresh token
  // Old token removed, new token issued
  // If attacker tries old token → reuse detection fires
  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);

  // Remove old token, store new one — atomic from user's perspective
  await removeRefreshToken(user.id, refreshToken);
  await storeRefreshToken(user.id, newRefreshToken);

  // Blacklist old refresh token explicitly
  await blacklistToken(refreshToken);

  await log(EVENT.TOKEN_REFRESH, user.email, req);

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken, // client must store this new one
    message: "Token refreshed.",
  };
}

async function logout(refreshToken, req) {
  // Decode to get userId — needed for Redis cleanup
  let userId;
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    userId = decoded.id;
  } catch (err) {
    // Token expired or invalid — still blacklist it
    // Can't get userId but that's ok
  }

  // Blacklist the refresh token
  await blacklistToken(refreshToken);

  // Remove from active tokens for this device
  if (userId) {
    await removeRefreshToken(userId, refreshToken);
  }

  await log(EVENT.LOGOUT, req.user?.email || "unknown", req);

  return {
    success: true,
    message: "Logged out successfully.",
  };
}

async function logoutAllDevices(userId, req) {
  // Remove ALL refresh tokens for this user
  await removeAllRefreshTokens(userId);

  // Invalidate user cache
  const user = await findUserById(userId);
  if (user) {
    await invalidateUserCache(user.email);
  }

  await log(EVENT.LOGOUT, req.user?.email || "unknown", req, {
    reason: "all devices logout",
  });

  return {
    success: true,
    message: "Logged out from all devices.",
  };
}

async function setup2FA(userId) {
  const user = await findUserById(userId);

  if (!user) {
    return {
      success: false,
      status: 404,
      message: "User not found.",
    };
  }

  const secret = speakeasy.generateSecret({
    name: `LoginService (${user.email})`,
  });

  await updateTwoFactorSecret(userId, secret.base32);

  // Invalidate cache — user data changed
  await invalidateUserCache(user.email);

  return {
    success: true,
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    message:
      "2FA secret generated. Scan the QR code with your authenticator app.",
  };
}

module.exports = {
  loginStep1,
  loginStep2,
  refresh,
  logout,
  logoutAllDevices,
  setup2FA,
};
