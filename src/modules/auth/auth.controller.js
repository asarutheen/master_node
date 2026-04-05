// Controller layer — handles req and res only.
// Calls service functions and translates results into HTTP responses.
// No business logic here — just input extraction and response formatting.

const {
  loginStep1,
  loginStep2,
  refresh,
  logout,
  setup2FA,
} = require("./auth.service");

// POST /auth/login
// Step 1 — validates email + password, returns tempToken if 2FA enabled
async function handleLoginStep1(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const result = await loginStep1(email, password, req);

  return res.status(result.status || 200).json(result);
}

// POST /auth/verify-otp
// Step 2 — validates tempToken + OTP, returns real tokens
async function handleLoginStep2(req, res) {
  const { tempToken, otp } = req.body;

  if (!tempToken || !otp) {
    return res.status(400).json({
      success: false,
      message: "Temp token and OTP are required.",
    });
  }

  const result = await loginStep2(tempToken, otp, req);

  return res.status(result.status || 200).json(result);
}

// POST /auth/refresh
async function handleRefresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "Refresh token is required.",
    });
  }

  const result = await refresh(refreshToken, req);

  return res.status(result.status || 200).json(result);
}

// POST /auth/logout
async function handleLogout(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "Refresh token is required.",
    });
  }

  const result = await logout(refreshToken, req);

  return res.status(200).json(result);
}

// POST /auth/2fa/setup
// Protected — user must be logged in to set up 2FA
async function handle2FASetup(req, res) {
  // req.user comes from verifyToken middleware
  const result = await setup2FA(req.user.id);

  return res.status(result.status || 200).json(result);
}

async function handleLogoutAllDevices(req, res) {
  const result = await logoutAllDevices(req.user.id, req);
  return res.status(200).json(result);
}

module.exports = {
  handleLoginStep1,
  handleLoginStep2,
  handleRefresh,
  handleLogout,
  handle2FASetup,
  handleLogoutAllDevices,
};
