const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * JWT Authentication Middleware
 * Validates the Authorization: Bearer <token> header.
 * Populates req.user with decoded payload:
 * { id, role, association_id, name, email, member_code }
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token expired. Please refresh your token or log in again.',
            code: 'TOKEN_EXPIRED',
          });
        }
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token.',
          code: 'TOKEN_INVALID',
        });
      }

      req.user = {
        id: decoded.id,
        role: decoded.role,
        association_id: decoded.association_id,
        name: decoded.name,
        email: decoded.email,
        member_code: decoded.member_code,
      };

      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error.',
      error: error.message,
    });
  }
};

/**
 * Optional Authentication Middleware
 * Parses token if present, but does not block requests if missing.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (!err && decoded) {
      req.user = {
        id: decoded.id,
        role: decoded.role,
        association_id: decoded.association_id,
        name: decoded.name,
        email: decoded.email,
        member_code: decoded.member_code,
      };
    }
    next();
  });
};

module.exports = {
  authenticate,
  optionalAuth,
};
