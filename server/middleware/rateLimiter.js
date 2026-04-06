/**
 * Rate Limiting Middleware
 * Protects endpoints from abuse
 */

const config = require('../config');

// In-memory store for rate limiting
const rateLimitStore = new Map();

/**
 * Cleanup old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Create rate limiter middleware
 */
const createRateLimiter = (options) => {
  const { windowMs, max, keyGenerator, skipSuccessfulRequests = false } = options;
  
  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : getDefaultKey(req);
    const now = Date.now();
    
    let data = rateLimitStore.get(key);
    
    if (!data || now > data.resetTime) {
      data = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    data.count += 1;
    rateLimitStore.set(key, data);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - data.count),
      'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000),
    });
    
    if (data.count > max) {
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((data.resetTime - now) / 1000),
        },
      });
    }
    
    // Option to skip successful requests from counting
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        if (res.statusCode < 400) {
          data.count -= 1;
          rateLimitStore.set(key, data);
        }
        return originalSend.call(this, body);
      };
    }
    
    next();
  };
};

/**
 * Get default rate limit key (IP + userId if available)
 * Prevents IP spoofing by validating IP format
 */
const getDefaultKey = (req) => {
  let ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Sanitize IP - remove any potential injection attempts
  if (typeof ip === 'string') {
    // Keep only valid IP address format
    ip = ip.replace(/[^0-9a-fA-F:.]/g, '');
  }
  
  const userId = req.user?._id || req.headers['x-guest-id'] || 'anonymous';
  return `${ip}:${userId}`;
};

/**
 * Pre-configured rate limiters
 */
const authLimiter = createRateLimiter({
  ...config.rateLimit.auth,
  keyGenerator: (req) => `auth:${req.ip}`,
});

const urlLimiter = createRateLimiter({
  ...config.rateLimit.url,
  keyGenerator: (req) => {
    const ip = req.ip;
    const userId = req.user?._id?.toString() || 'guest';
    return `url:${ip}:${userId}`;
  },
});

const guestLimiter = createRateLimiter({
  ...config.rateLimit.guest,
  keyGenerator: (req) => `guest:${req.ip}`,
});

const otpResendLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 resends per 15 minutes
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    const ip = req.ip || 'unknown';
    return `otp-resend:${email}:${ip}`;
  },
});

module.exports = {
  createRateLimiter,
  authLimiter,
  urlLimiter,
  guestLimiter,
  otpResendLimiter,
};
