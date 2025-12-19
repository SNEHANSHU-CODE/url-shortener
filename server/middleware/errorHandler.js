/**
 * Error Handler Middleware
 * Centralized error handling
 */

const config = require('../config');
const { AppError } = require('../utils/AppError');

/**
 * Error response formatter
 */
const formatError = (err, includeStack = false) => {
  const response = {
    success: false,
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    },
  };
  
  if (includeStack && err.stack) {
    response.error.stack = err.stack;
  }
  
  return response;
};

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  console.error(`[ERROR] ${err.code || 'UNKNOWN'}: ${err.message}`);
  if (config.nodeEnv === 'development') {
    console.error(err.stack);
  }
  
  // Handle known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(formatError(err));
  }
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: {
        message: messages.join(', '),
        code: 'VALIDATION_ERROR',
      },
    });
  }
  
  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      error: {
        message: `${field} already exists`,
        code: 'DUPLICATE_ERROR',
      },
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      },
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      },
    });
  }
  
  // Generic server error (hide details in production)
  const isDev = config.nodeEnv === 'development';
  return res.status(500).json(formatError(
    { message: isDev ? err.message : 'Internal server error', code: 'INTERNAL_ERROR' },
    isDev
  ));
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  });
};

module.exports = { errorHandler, notFoundHandler };
