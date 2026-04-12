/**
 * Authentication Middleware
 * Handles JWT verification and user attachment
 */

const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');
const { errors } = require('../utils/AppError');

/**
 * Require authentication
 * Attaches user to req.user and validates token integrity
 * Supports both Bearer token and httpOnly cookie
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    
    // Try Bearer token first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Fall back to httpOnly cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (!token) {
      throw errors.unauthorized('No token provided');
    }
    
    // Validate token format
    if (typeof token !== 'string' || token.length === 0) {
      throw errors.unauthorized('Invalid token format');
    }
    
    const decoded = verifyAccessToken(token);
    
    if (!decoded || !decoded.userId) {
      throw errors.unauthorized('Invalid or expired token');
    }
    
    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    
    if (!user) {
      throw errors.unauthorized('User not found');
    }
    
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication
 * Attaches user if token is valid, continues if not
 * Supports both Bearer token and httpOnly cookie
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    
    // Try Bearer token first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Fall back to httpOnly cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (token) {
      const decoded = verifyAccessToken(token);
      
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId).select('-password -refreshToken');
        req.user = user;
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = { requireAuth, optionalAuth };
