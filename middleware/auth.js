const jwt = require("jsonwebtoken");

// This middleware runs before any protected route handler.
// If the token is missing, invalid, or expired — the request is blocked here.
// If valid — we attach the decoded user payload to req.user and move on.

function verifyToken(req, res, next) {
  // Step 1 — check the Authorization header
  // Expected format: "Bearer <token>"
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  // Step 2 — extract the token (strip "Bearer ")
  const token = authHeader.split(" ")[1];

  // Step 3 — verify the token against our secret
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 4 — attach decoded payload to request so route handlers can use it
    // decoded will contain: { id, name, email, iat, exp }
    req.user = decoded;

    next(); // token is valid — proceed to the route handler
  } catch (err) {
    // jwt.verify throws specific errors we can handle:
    //   TokenExpiredError  — token is valid but past its expiry time
    //   JsonWebTokenError  — token is malformed or signature is wrong

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please log in again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
}

module.exports = { verifyToken };
