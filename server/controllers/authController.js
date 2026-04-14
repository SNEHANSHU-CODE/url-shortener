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
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
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
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
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

    if (!email || !password || !name) {
      throw AppError.badRequest('Email, password, and name are required');
    }

    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    if (password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one number');
    }

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
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }

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
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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

    console.log('Google login attempt with token:', token.substring(0, 20) + '...');

    const result = await googleAuthService.authenticateWithGoogle(token, guestId);

    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);

    console.log('Google login successful for user:', result.user.email);

    res.json({
      success: true,
      data: {
        user: result.user,
        isNewUser: result.isNewUser,
        migratedUrls: result.migratedUrls,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    console.error('Google login error in controller:', error.message);
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
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      await authService.logout(req.user._id);
    }

    const cookieOptions = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
      path: '/',
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

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

    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    await authService.requestPasswordReset(normalizedEmail);

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
 */
const initGuest = async (req, res, next) => {
  try {
    const existingGuestId = req.headers['x-guest-id'];
    const fingerprint = req.headers['x-guest-fingerprint'];

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || null;

    if (existingGuestId) {
      const isValid = await guestService.validateGuest(existingGuestId);
      if (isValid) {
        if (fingerprint && !isValid.fingerprint) {
          isValid.fingerprint = fingerprint;
          await isValid.save();
        }
        return res.json({
          success: true,
          data: {
            guestId: existingGuestId,
            isReturning: true,
          },
        });
      }
    }

    if (fingerprint) {
      const existingByFingerprint = await guestService.findByFingerprint(fingerprint);
      if (existingByFingerprint) {
        return res.json({
          success: true,
          data: {
            guestId: existingByFingerprint.guestId,
            isReturning: true,
            recovered: true,
          },
        });
      }
    }

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

    if (!email || !password || !name) {
      throw AppError.badRequest('Email, password, and name are required');
    }

    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    if (password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw AppError.badRequest('Password must contain at least one number');
    }

    if (name.length < 2 || name.length > 50) {
      throw AppError.badRequest('Name must be between 2 and 50 characters');
    }

    const existingUser = await authService.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw AppError.conflict('Email already registered');
    }

    // Clear any stale OTP from a previous attempt (rate-limit hit, page refresh, etc.)
    otpService.clearOTP(normalizedEmail);

    await otpService.requestRegistrationOTP(normalizedEmail, {
      email: normalizedEmail,
      password,
      name,
    });

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

    // Always normalize email consistently — OTP was stored with lowercased key
    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP first (this consumes it, preventing replay attacks)
    const verification = otpService.verifyOTP(normalizedEmail, otp);
    if (!verification.valid) {
      throw AppError.badRequest(verification.error);
    }

    // FIX: Check for duplicate email AFTER OTP is verified but BEFORE creating user.
    // If the user already exists at this point it means:
    //   - They double-submitted (clicked the button twice quickly), OR
    //   - A concurrent request already created the account successfully.
    // In both cases the correct response is to treat it as a successful login
    // by returning the existing user's session, NOT throwing an error.
    const alreadyExists = await authService.findUserByEmail(normalizedEmail);
    if (alreadyExists) {
      // The account was just created (race/double-submit) — log them in instead
      const tokens = require('../utils/jwt').generateTokenPair(alreadyExists._id);
      alreadyExists.refreshToken = tokens.refreshToken;
      await alreadyExists.save();

      setAccessTokenCookie(res, tokens.accessToken);
      setRefreshTokenCookie(res, tokens.refreshToken);

      return res.status(200).json({
        success: true,
        data: {
          user: alreadyExists,
          migratedUrls: 0,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    }

    const { email: userEmail, password, name } = verification.userData;
    const result = await authService.register({ email: userEmail, password, name }, guestId);

    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        migratedUrls: result.migratedUrls,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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

    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    const existingUser = await authService.findUserByEmail(normalizedEmail);
    if (!existingUser) {
      return res.json({
        success: true,
        message: 'If an account exists, an OTP has been sent.',
      });
    }

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

    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

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
 * FIX: Was using undefined `normalizedEmail` variable; now correctly defined.
 */
const resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      throw AppError.badRequest('Email, OTP, and new password are required');
    }

    // FIX: normalizedEmail was missing — caused ReferenceError crash
    const validator = require('validator');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail)) {
      throw AppError.badRequest('Invalid email format');
    }

    // Verify OTP and clear it
    const verification = otpService.verifyPasswordResetOTP(normalizedEmail, otp, true);
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
 */
const deleteAccountWithGoogle = async (req, res, next) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      throw AppError.badRequest('Google token is required');
    }

    const axios = require('axios');

    const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const googleEmail = googleResponse.data.email;

    if (googleEmail !== req.user.email) {
      throw AppError.unauthorized('Google account does not match your account');
    }

    const result = await authService.deleteAccountByUserId(req.user._id);

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