/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, authLimiter } = require('../middleware');

// Apply rate limiting to auth routes
router.use(authLimiter);

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// OTP routes
router.post('/send-otp', authController.sendRegistrationOTP);
router.post('/verify-otp', authController.verifyOTPAndRegister);
router.post('/resend-otp', authController.resendOTP);

// Forgot Password OTP routes
router.post('/forgot-password/send-otp', authController.sendForgotPasswordOTP);
router.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOTP);
router.post('/forgot-password/reset', authController.resetPasswordWithOTP);

// Guest initialization
router.post('/guest', authController.initGuest);

// Protected routes
router.get('/me', requireAuth, authController.getCurrentUser);
router.delete('/account', requireAuth, authController.deleteAccount);
router.delete('/account/google', requireAuth, authController.deleteAccountWithGoogle);

module.exports = router;
