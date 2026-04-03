const jwt = require("jsonwebtoken");

// Verifies the JWT access token on every protected request.
// Attaches decoded user payload to req.user for downstream handlers.
// This runs BEFORE the route handler — if it fails the handler never runs.

function verifyToken(req, res, next) {
  // Step 1 — check Authorization header exists and is correctly formatted
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  // Step 2 — extract token by stripping "Bearer "
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Token is malformed.",
    });
  }

  // Step 3 — verify signature and expiry
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 4 — reject if this is a temp token not a real access token
    // Temp tokens from 2FA flow must never access protected routes
    if (decoded.step === "awaiting_otp") {
      return res.status(401).json({
        success: false,
        message: "Access denied. Complete 2FA verification first.",
      });
    }

    // Step 5 — attach decoded payload to request
    // Available downstream as req.user.id, req.user.role etc.
    req.user = decoded;

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please refresh your token.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please log in again.",
      });
    }

    // Catch anything else — NotBeforeError etc.
    return res.status(401).json({
      success: false,
      message: "Token verification failed.",
    });
  }
}

module.exports = { verifyToken };
