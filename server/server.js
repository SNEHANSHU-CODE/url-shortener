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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
}));

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

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id', 'X-Guest-Fingerprint'],
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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
    
    // Hotload URLs from MongoDB to Redis cache on server startup
    if (urlCache.connected) {
      await hotloadUrlsToCache();
    } else {
      console.log('Skipping hotload: Redis cache not connected');
    }
    
    // Start URL cleanup scheduler (cleans expired guest URLs every hour)
    startCleanupScheduler();
    
    // Start listening
    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`📊 Cache status: ${urlCache.getStats().connected ? '✅ Connected to Upstash Redis' : '⚠️  Cache disabled'}`);
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