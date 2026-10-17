/**
 * Role-based authorization middleware factory
 * @param  {...string|string[]} allowedRoles - List or array of roles permitted to access the route
 * Roles: 'super_admin', 'admin', 'member'
 */
const authorize = (...allowedRoles) => {
  // Flatten in case array was passed as single argument
  const flatRoles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking permissions.',
      });
    }

    if (!flatRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access denied. Required role(s): ${flatRoles.join(', ')}. Current role: ${req.user.role}`,
      });
    }

    next();
  };
};

module.exports = {
  authorize,
};
