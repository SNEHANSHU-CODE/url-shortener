/**
 * Auth Service
 * Handles authentication business logic
 */

const { User } = require('../models');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { errors } = require('../utils/AppError');
const crypto = require('crypto');
const guestService = require('./guestService');

class AuthService {
  /**
   * Register a new user
   */
  async register({ email, password, name }, guestId = null) {
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw errors.conflict('Email already registered');
    }
    
    // Create user
    const user = new User({ email, password, name });
    await user.save();
    
    // Generate tokens
    const tokens = generateTokenPair(user._id);
    
    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();
    
    // Migrate guest URLs if guestId provided
    let migratedUrls = 0;
    if (guestId) {
      const migration = await guestService.migrateToUser(guestId, user._id);
      migratedUrls = migration.migrated;
    }
    
    return { user, ...tokens, migratedUrls };
  }
  
  /**
   * Login user with email and password
   */
  async login({ email, password }, guestId = null) {
    const user = await User.findOne({ email });
    
    if (!user) {
      throw errors.unauthorized('Invalid credentials');
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw errors.unauthorized('Invalid credentials');
    }
    
    // Generate tokens
    const tokens = generateTokenPair(user._id);
    
    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();
    
    // Migrate guest URLs if guestId provided
    let migratedUrls = 0;
    if (guestId) {
      const migration = await guestService.migrateToUser(guestId, user._id);
      migratedUrls = migration.migrated;
    }
    
    return { user, ...tokens, migratedUrls };
  }
  
  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw errors.unauthorized('Refresh token required');
    }
    
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw errors.unauthorized('Invalid refresh token');
    }
    
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw errors.unauthorized('Invalid refresh token');
    }
    
    // Generate new tokens (rotation)
    const tokens = generateTokenPair(user._id);
    
    // Save new refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();
    
    return { user, ...tokens };
  }
  
  /**
   * Logout user
   */
  async logout(userId) {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
  }
  
  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If email exists, reset link will be sent' };
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();
    
    // In production, send email here
    // For now, return token (dev only)
    return { message: 'Password reset link sent', resetToken };
  }
  
  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    });
    
    if (!user) {
      throw errors.badRequest('Invalid or expired reset token');
    }
    
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    user.refreshToken = null; // Invalidate all sessions
    await user.save();
    
    return { message: 'Password reset successful' };
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    return User.findOne({ email });
  }

  /**
   * Reset password by email (used after OTP verification)
   */
  async resetPasswordByEmail(email, newPassword) {
    const user = await User.findOne({ email });
    
    if (!user) {
      throw errors.notFound('User not found');
    }
    
    user.password = newPassword;
    user.refreshToken = null; // Invalidate all sessions
    await user.save();
    
    return { message: 'Password reset successful' };
  }

  /**
   * Delete user account and all associated data
   */
  async deleteAccount(userId, password) {
    const { Url } = require('../models');
    
    const user = await User.findById(userId);
    
    if (!user) {
      throw errors.notFound('User not found');
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw errors.unauthorized('Invalid password');
    }
    
    // Delete all user's URLs
    const urlResult = await Url.deleteMany({ userId });
    
    // Delete user
    await User.findByIdAndDelete(userId);
    
    console.log(`🗑️ Deleted account for user ${userId} with ${urlResult.deletedCount} URLs`);
    
    return { 
      message: 'Account deleted successfully',
      deletedUrls: urlResult.deletedCount 
    };
  }

  /**
   * Delete user account by userId (for Google authenticated users)
   */
  async deleteAccountByUserId(userId) {
    const { Url } = require('../models');
    
    const user = await User.findById(userId);
    
    if (!user) {
      throw errors.notFound('User not found');
    }
    
    // Delete all user's URLs
    const urlResult = await Url.deleteMany({ userId });
    
    // Delete user
    await User.findByIdAndDelete(userId);
    
    console.log(`🗑️ Deleted account for user ${userId} with ${urlResult.deletedCount} URLs`);
    
    return { 
      message: 'Account deleted successfully',
      deletedUrls: urlResult.deletedCount 
    };
  }
}

module.exports = new AuthService();
