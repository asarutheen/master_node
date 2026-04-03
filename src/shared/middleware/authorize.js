// Role-based access control (RBAC) middleware.
// Always runs AFTER verifyToken — req.user must exist.
//
// Usage:
//   Single role:    authorize("admin")
//   Multiple roles: authorize("admin", "moderator")

function authorize(...roles) {
  return (req, res, next) => {
    // Safety check — verifyToken should always run first
    // This catches misconfigured routes where authorize runs alone
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Not authenticated.",
      });
    }

    // Check if user's role is in the allowed list
    if (!roles.includes(req.user.role)) {
      console.warn(
        `[AUTHZ] Forbidden: user ${req.user.email} with role ` +
          `"${req.user.role}" tried to access a route requiring [${roles.join(", ")}]`,
      );

      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to do this.",
      });
    }

    next();
  };
}

module.exports = { authorize };
