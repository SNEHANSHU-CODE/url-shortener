/**
 * URL Shortener Server
 * Main entry point
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const connectDatabase = require('./config/database');
const { authRoutes, urlRoutes, redirectRoutes } = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware');
const { startCleanupScheduler } = require('./services/cleanupService');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id'],
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// Redirect routes (must be last to avoid conflicts)
app.use('/', redirectRoutes);

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
    
    // Start URL cleanup scheduler (cleans expired guest URLs every hour)
    startCleanupScheduler();
    
    // Start listening
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
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