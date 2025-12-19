/**
 * Authentication Middleware
 * Handles JWT verification and user attachment
 */

const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');
const { errors } = require('../utils/AppError');

/**
 * Require authentication
 * Attaches user to req.user
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errors.unauthorized('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
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
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (decoded) {
      const user = await User.findById(decoded.userId).select('-password -refreshToken');
      req.user = user;
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
