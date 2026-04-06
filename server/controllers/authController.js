/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 */

const authService = require('../services/authService');
const googleAuthService = require('../services/googleAuthService');
const guestService = require('../services/guestService');
const otpService = require('../services/otpService');
const config = require('../config');
const { AppError } = require('../utils/AppError');

/**
 * Set access token cookie
 */
const setAccessTokenCookie = (res, token) => {
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
};

/**
 * Set refresh token cookie
 */
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Register new user
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const guestId = req.headers['x-guest-id'];
    
    // Validate inputs
    if (!email || !password || !name) {
      throw AppError.badRequest('Email, password, and name are required');
    }
    
    // Normalize and validate email
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }
    
    // Validate password strength (min 8 chars, at least 1 uppercase, 1 number)
    if (password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one number');
    }
    
    // Validate name (2-50 characters)
    if (name.length < 2 || name.length > 50) {
      throw AppError.badRequest('Name must be between 2 and 50 characters');
    }
    
    const result = await authService.register({ email: normalizedEmail, password, name }, guestId);
    
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        migratedUrls: result.migratedUrls,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const guestId = req.headers['x-guest-id'];
    
    // Validate inputs
    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }
    
    // Validate email format
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }
    
    const result = await authService.login({ email: normalizedEmail, password }, guestId);
    
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    
    res.json({
      success: true,
      data: {
        user: result.user,
        migratedUrls: result.migratedUrls,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Google OAuth login
 */
const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    const guestId = req.headers['x-guest-id'];
    
    if (!token) {
      throw AppError.badRequest('Google token is required');
    }
    
    const result = await googleAuthService.authenticateWithGoogle(token, guestId);
    
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    
    res.json({
      success: true,
      data: {
        user: result.user,
        isNewUser: result.isNewUser,
        migratedUrls: result.migratedUrls,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    
    if (!token) {
      throw AppError.unauthorized('No refresh token provided');
    }
    
    const result = await authService.refreshToken(token);
    
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    
    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * Validates that the user making the request matches the token user
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    
    if (token) {
      // Verify token and extract userId
      const { verifyRefreshToken } = require('../utils/jwt');
      const decoded = verifyRefreshToken(token);
      
      // Validate that token user matches authenticated user
      if (decoded && decoded.userId !== req.user._id.toString()) {
        throw AppError.unauthorized('Token user does not match authenticated user');
      }
      
      // Logout only if authenticated
      if (decoded) {
        await authService.logout(req.user._id);
      }
    }
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      throw AppError.badRequest('Email is required');
    }
    
    // Normalize and validate email format
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }
    
    await authService.requestPasswordReset(normalizedEmail);
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists, a password reset email has been sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    await authService.resetPassword(token, newPassword);
    
    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize guest session
 * Enterprise-standard guest identification:
 * 1. Check existing guestId from header
 * 2. Check browser fingerprint for returning visitors
 * 3. Create new guest if no match
 */
const initGuest = async (req, res, next) => {
  try {
    const existingGuestId = req.headers['x-guest-id'];
    const fingerprint = req.headers['x-guest-fingerprint'];
    
    // Get IP address and user agent from request
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || null;
    
    // Validate existing guest first
    if (existingGuestId) {
      const isValid = await guestService.validateGuest(existingGuestId);
      if (isValid) {
        // Update fingerprint if provided and not set
        if (fingerprint && !isValid.fingerprint) {
          isValid.fingerprint = fingerprint;
          await isValid.save();
        }
        return res.json({
          success: true,
          data: { 
            guestId: existingGuestId,
            isReturning: true 
          },
        });
      }
    }
    
    // Try to find by fingerprint (returning visitor who cleared localStorage)
    if (fingerprint) {
      const existingByFingerprint = await guestService.findByFingerprint(fingerprint);
      if (existingByFingerprint) {
        return res.json({
          success: true,
          data: { 
            guestId: existingByFingerprint.guestId,
            isReturning: true,
            recovered: true // Indicates we recovered guest from fingerprint
          },
        });
      }
    }
    
    // Create new guest with fingerprint
    const guest = await guestService.getOrCreateGuest(null, ipAddress, userAgent, fingerprint);
    
    res.json({
      success: true,
      data: { guestId: guest.guestId },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP for registration
 */
const sendRegistrationOTP = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Validate inputs
    if (!email || !password || !name) {
      throw AppError.badRequest('Email, password, and name are required');
    }
    
    // Normalize and validate email format
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }
    
    // Validate password strength
    if (password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one number');
    }
    
    // Validate name
    if (name.length < 2 || name.length > 50) {
      throw AppError.badRequest('Name must be between 2 and 50 characters');
    }

    // Check if email already exists
    const existingUser = await authService.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw AppError.conflict('Email already registered');
    }

    // Send OTP
    await otpService.requestRegistrationOTP(normalizedEmail, { email: normalizedEmail, password, name });

    res.json({
      success: true,
      message: 'OTP sent successfully. Please check your email.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP and complete registration
 */
const verifyOTPAndRegister = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const guestId = req.headers['x-guest-id'];

    if (!email || !otp) {
      throw AppError.badRequest('Email and OTP are required');
    }

    // Verify OTP
    const verification = otpService.verifyOTP(email, otp);
    if (!verification.valid) {
      throw AppError.badRequest(verification.error);
    }

    // Complete registration with stored user data
    const { email: userEmail, password, name } = verification.userData;
    const result = await authService.register({ email: userEmail, password, name }, guestId);

    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        migratedUrls: result.migratedUrls,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend OTP
 */
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw AppError.badRequest('Email is required');
    }
    
    // Normalize and validate email format
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    await otpService.resendOTP(normalizedEmail);

    res.json({
      success: true,
      message: 'OTP resent successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP for forgot password
 */
const sendForgotPasswordOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw AppError.badRequest('Email is required');
    }
    
    // Normalize and validate email format
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    // Check if user exists
    const existingUser = await authService.findUserByEmail(normalizedEmail);
    if (!existingUser) {
      // Return success anyway to prevent email enumeration
      return res.json({
        success: true,
        message: 'If an account exists, an OTP has been sent.',
      });
    }

    // Send OTP for password reset
    await otpService.requestPasswordResetOTP(normalizedEmail);

    res.json({
      success: true,
      message: 'OTP sent successfully. Please check your email.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP for forgot password
 */
const verifyForgotPasswordOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw AppError.badRequest('Email and OTP are required');
    }
    
    // Normalize and validate email format
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    // Verify OTP (don't clear it yet, just validate)
    const verification = await otpService.verifyPasswordResetOTP(normalizedEmail, otp, false);
    if (!verification.valid) {
      throw AppError.badRequest(verification.error || 'Invalid or expired OTP');
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with OTP
 */
const resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      throw AppError.badRequest('Email, OTP, and new password are required');
    }

    // Verify OTP and clear it
    const verification = otpService.verifyPasswordResetOTP(email, otp, true);
    if (!verification.valid) {
      throw AppError.badRequest(verification.error || 'Invalid or expired OTP');
    }

    // Reset password
    await authService.resetPasswordByEmail(normalizedEmail, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 */
const deleteAccount = async (req, res, next) => {
  try {
    const { password, confirmText } = req.body;

    if (!password) {
      throw AppError.badRequest('Password is required');
    }

    if (confirmText !== 'DELETE') {
      throw AppError.badRequest('Please type DELETE to confirm');
    }

    const result = await authService.deleteAccount(req.user._id, password);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: result.message,
      deletedUrls: result.deletedUrls,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account with Google verification
 * Google users don't need to type DELETE - Google verification is enough
 */
const deleteAccountWithGoogle = async (req, res, next) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      throw AppError.badRequest('Google token is required');
    }

    // Verify Google token and get user info
    const googleAuthService = require('../services/googleAuthService');
    const axios = require('axios');
    
    // Get user info from Google
    const googleResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    const googleEmail = googleResponse.data.email;
    
    // Verify the Google email matches the logged-in user
    if (googleEmail !== req.user.email) {
      throw AppError.unauthorized('Google account does not match your account');
    }

    const result = await authService.deleteAccountByUserId(req.user._id);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: result.message,
      deletedUrls: result.deletedUrls,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  refreshToken,
  logout,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
  initGuest,
  sendRegistrationOTP,
  verifyOTPAndRegister,
  resendOTP,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPasswordWithOTP,
  deleteAccount,
  deleteAccountWithGoogle,
};
