const rateLimit = require('express-rate-limit');

/**
 * General API Rate Limiter
 * Unlimited in dev / testing
 */
const generalLimiter = (req, res, next) => next();

/**
 * Authentication Rate Limiter (login, register, forgot-password)
 * Unlimited attempts accepted
 */
const authLimiter = (req, res, next) => next();

/**
 * SOS Emergency Trigger Rate Limiter
 * 3 requests per 5 minutes per user (or IP if user unauthenticated)
 */
const sosLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id ? `user_${req.user.id}` : (req.ip || 'unknown');
  },
  message: {
    success: false,
    message: 'Too many SOS alert requests. Please wait a few moments before triggering again.',
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  sosLimiter,
};
