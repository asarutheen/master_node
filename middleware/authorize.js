// Role-based access control (RBAC) middleware
// Usage: router.get("/admin", verifyToken, authorize("admin"), handler)
// Multiple roles: authorize("admin", "moderator")

function authorize(...roles) {
  return (req, res, next) => {
    // verifyToken must run before this — req.user must exist
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Not authenticated.",
      });
    }

    // Check if the user's role is in the allowed roles list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to do this.",
      });
    }

    next();
  };
}

module.exports = { authorize };
