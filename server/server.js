/**
 * URL Shortener Server
 * Main entry point
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const config = require('./config');
const connectDatabase = require('./config/database');
const { authRoutes, urlRoutes, redirectRoutes } = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware');
const { startCleanupScheduler } = require('./services/cleanupService');
const urlCache = require('./utils/cache');
const { hotloadUrlsToCache } = require('./utils/hotload');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Rate limiter: 100 requests per hour
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after an hour',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit of 100 requests per hour. Please try again later.',
      retryAfter: req.rateLimit.resetTime,
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/ping';
  },
});

// Security middleware with strict headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://*.googleapis.com'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      fontSrc: ["'self'", 'data:'],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  xssFilter: true,
  noSniff: true,
  dnsPrefetchControl: { allow: false },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Cache control middleware
app.use((req, res, next) => {
  if (req.method === 'GET') {
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/i)) {
      // Static assets: 1 year cache with immutable flag
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (req.path.startsWith('/api/')) {
      // API responses: no cache by default
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    } else {
      // HTML pages: 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  } else {
    // Non-GET requests: no cache
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  }
  next();
});

// HTTPS redirect for production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    // Check if request is not already HTTPS
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    if (protocol !== 'https') {
      // Redirect to HTTPS
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
}

// Request logging with custom format for better readability
if (config.nodeEnv !== 'test') {
  // Skip favicon and health check logging
  app.use(morgan('dev', {
    skip: (req) => req.path === '/favicon.ico' || req.path === '/health',
  }));
}

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id', 'X-Guest-Fingerprint'],
}));

// Body parsing with compression
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(compression());

// Cookie parsing
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Cache status endpoint (debug only)
app.get('/api/cache-status', (req, res) => {
  const stats = urlCache.getStats();
  res.json({
    success: true,
    data: {
      ...stats,
      message: stats.connected 
        ? 'Redis.com cache is connected and working'
        : 'Redis.com cache is not connected - check REDIS_HOST, REDIS_PORT, REDIS_PASSWORD in .env',
      hitRate: stats.hitRate,
    },
  });
});

// Legacy ping endpoint for backward compatibility
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Apply rate limiter to all API routes
app.use('/api/', apiLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// Serve static files from React build
const clientBuildPath = path.join(__dirname, '../client/build');
app.use(express.static(clientBuildPath));

// Middleware: Prevent caching of short URL redirects
// This must run before redirectRoutes to disable browser caching of 301 responses
app.use((req, res, next) => {
  // Check if this looks like a short code (short path, not starting with /api or known routes)
  if (req.method === 'GET' && 
      !req.path.startsWith('/api') && 
      !req.path.startsWith('/health') &&
      !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/i) &&
      req.path !== '/' &&
      req.path.length < 100) { // Short codes are typically < 10 chars
    // Disable all caching for redirect responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Redirect routes (handles short URL redirects)
app.use('/', redirectRoutes);

// Catch-all: serve React app for any unmatched routes (SPA support)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      next(err);
    }
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Wait for cache to initialize
    console.log('Initializing cache...');
    await urlCache.waitForInitialization();
    
    // Hotload URLs from MongoDB to Redis cache on server startup
    if (urlCache.connected) {
      console.log('Cache connected, starting hotload...');
      await hotloadUrlsToCache();
    } else {
      console.log('Skipping hotload: Redis cache not connected. Check REDIS_HOST, REDIS_PORT, REDIS_PASSWORD in .env');
    }
    
    // Start URL cleanup scheduler (cleans expired guest URLs every hour)
    startCleanupScheduler();
    
    // Start listening
    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`📊 Cache status: ${urlCache.getStats().connected ? '✅ Connected to Redis.com' : '⚠️  Cache disabled'}`);
    });
    
    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('Server closed');
        
        // Close Redis connection
        await urlCache.destroy();
        
        console.log('Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after 10 seconds');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = app;