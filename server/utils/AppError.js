/**
 * Custom Application Error
 * Extends Error for consistent error handling
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }

  // Static factory methods
  static badRequest(message = 'Bad request') {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict') {
    return new AppError(message, 409, 'CONFLICT');
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

// Common error factory functions (for backward compatibility)
const errors = {
  badRequest: (message = 'Bad request') => 
    new AppError(message, 400, 'BAD_REQUEST'),
  
  unauthorized: (message = 'Unauthorized') => 
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message = 'Forbidden') => 
    new AppError(message, 403, 'FORBIDDEN'),
  
  notFound: (message = 'Not found') => 
    new AppError(message, 404, 'NOT_FOUND'),
  
  conflict: (message = 'Conflict') => 
    new AppError(message, 409, 'CONFLICT'),
  
  tooManyRequests: (message = 'Too many requests') => 
    new AppError(message, 429, 'TOO_MANY_REQUESTS'),
  
  internal: (message = 'Internal server error') => 
    new AppError(message, 500, 'INTERNAL_ERROR'),
};

module.exports = { AppError, errors };
