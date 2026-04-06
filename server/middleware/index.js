/**
 * Middleware exports
 */

const { requireAuth, optionalAuth } = require('./auth');
const { errorHandler, notFoundHandler } = require('./errorHandler');
const { authLimiter, urlLimiter, guestLimiter, otpResendLimiter, createRateLimiter } = require('./rateLimiter');

module.exports = {
  requireAuth,
  optionalAuth,
  errorHandler,
  notFoundHandler,
  authLimiter,
  urlLimiter,
  guestLimiter,
  otpResendLimiter,
  createRateLimiter,
};
