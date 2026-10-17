const rateLimit = require('express-rate-limit');

/**
 * General API Rate Limiter
 * 1000 requests per 15 minutes in dev, 100 in prod
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

/**
 * Authentication Rate Limiter (login, register, forgot-password)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
});

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
