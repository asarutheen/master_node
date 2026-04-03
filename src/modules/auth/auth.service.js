// Service layer — all business logic lives here.
// No req, no res, no SQL.
// Takes plain data in, returns plain data out.
// This makes it fully testable without HTTP or a real database.

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const {
  blacklistToken,
  isBlacklisted,
} = require("../../shared/utils/tokenStore");
const { log, EVENT } = require("../../shared/utils/auditLog");
const {
  findUserByEmail,
  findUserById,
  updateTwoFactorSecret,
  getLoginAttempts,
  recordFailedAttempt,
  lockAccount,
  resetLoginAttempts,
} = require("./auth.repository");

const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  // Short lived token used only between password check and OTP verification
  // step field prevents it from being used as a real access token
  return jwt.sign(
    { id: user.id, step: "awaiting_otp" },
    process.env.JWT_SECRET,
    { expiresIn: "2m" },
  );
}

// ── Lockout logic ─────────────────────────────────────────────────────────────

async function checkLockout(email) {
  const record = await getLoginAttempts(email);

  if (!record) return { locked: false };

  const now = new Date();

  // Lock has expired — clean up and allow
  if (record.locked_until && new Date(record.locked_until) < now) {
    await resetLoginAttempts(email);
    return { locked: false };
  }

  if (record.locked_until && new Date(record.locked_until) > now) {
    const remaining = Math.ceil(
      (new Date(record.locked_until) - now) / 1000 / 60,
    );
    return { locked: true, remaining };
  }

  return { locked: false };
}

async function handleFailedAttempt(email) {
  await recordFailedAttempt(email);

  const record = await getLoginAttempts(email);

  if (record.failed_attempts >= MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    await lockAccount(email, lockUntil);
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

  // Step 2 — find user
  const user = await findUserByEmail(email);

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
  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    await handleFailedAttempt(email);
    await log(EVENT.LOGIN_FAILED, email, req, { reason: "wrong password" });
    return {
      success: false,
      status: 401,
      message: "Invalid email or password.",
    };
  }

  // Step 4 — password correct, check if 2FA is enabled
  if (user.two_factor_secret) {
    // Issue a temp token — not an access token
    const tempToken = signTempToken(user);
    return {
      success: true,
      twoFactorRequired: true,
      tempToken,
      message: "Password verified. OTP required.",
    };
  }

  // Step 5 — no 2FA, issue real tokens
  await resetLoginAttempts(email);
  await log(EVENT.LOGIN_SUCCESS, email, req);

  return {
    success: true,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    message: "Login successful.",
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

  // Step 2 — confirm it is actually a temp token
  if (decoded.step !== "awaiting_otp") {
    return {
      success: false,
      status: 401,
      message: "Invalid token type.",
    };
  }

  // Step 3 — fetch fresh user data
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

  return {
    success: true,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    message: "Login successful.",
  };
}

async function refresh(refreshToken, req) {
  // Step 1 — check blacklist
  if (isBlacklisted(refreshToken)) {
    return {
      success: false,
      status: 401,
      message: "Refresh token revoked. Please log in again.",
    };
  }

  // Step 2 — verify token
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

  // Step 3 — fresh user lookup (picks up role changes etc.)
  const user = await findUserById(decoded.id);

  if (!user) {
    return {
      success: false,
      status: 401,
      message: "User no longer exists.",
    };
  }

  await log(EVENT.TOKEN_REFRESH, user.email, req);

  return {
    success: true,
    accessToken: signAccessToken(user),
    message: "Token refreshed.",
  };
}

async function logout(refreshToken, req) {
  blacklistToken(refreshToken);
  await log(EVENT.LOGOUT, req.user?.email || "unknown", req);

  return {
    success: true,
    message: "Logged out successfully.",
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
  setup2FA,
};
