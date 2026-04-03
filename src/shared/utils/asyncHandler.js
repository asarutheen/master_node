// Wraps async route handlers to catch unhandled promise rejections.
// Without this, async errors in Express 4 silently hang or crash.
// Express 5 does this automatically — until we upgrade, this is the fix.

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
