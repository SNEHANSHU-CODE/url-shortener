/**
 * OTP Service
 * Handles OTP generation and email sending
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const config = require('../config');

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

// Cleanup expired OTPs every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Create email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
};

/**
 * Send OTP email
 */
const sendOTPEmail = async (email, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"URL Shortener" <${config.smtp.from || config.smtp.user}>`,
    to: email,
    subject: 'Verify your email - URL Shortener',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d6efd;">Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0d6efd;">${otp}</span>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #6c757d; font-size: 12px;">URL Shortener - Shorten your links, amplify your reach.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Store OTP for email
 */
const storeOTP = (email, otp, userData = null) => {
  otpStore.set(email.toLowerCase(), {
    otp,
    userData,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });
};

/**
 * Verify OTP
 */
const verifyOTP = (email, inputOTP) => {
  const key = email.toLowerCase();
  const data = otpStore.get(key);

  if (!data) {
    return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
  }

  if (Date.now() > data.expiresAt) {
    otpStore.delete(key);
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }

  data.attempts += 1;

  if (data.attempts > 5) {
    otpStore.delete(key);
    return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
  }

  if (data.otp !== inputOTP) {
    otpStore.set(key, data);
    return { valid: false, error: 'Invalid OTP. Please try again.' };
  }

  // OTP is valid - get user data and delete OTP
  const userData = data.userData;
  otpStore.delete(key);

  return { valid: true, userData };
};

/**
 * Request OTP for registration
 */
const requestRegistrationOTP = async (email, userData) => {
  const otp = generateOTP();
  storeOTP(email, otp, userData);
  await sendOTPEmail(email, otp);
  return true;
};

/**
 * Resend OTP
 */
const resendOTP = async (email) => {
  const key = email.toLowerCase();
  const existingData = otpStore.get(key);

  if (!existingData) {
    throw new Error('No pending verification found. Please register again.');
  }

  const otp = generateOTP();
  existingData.otp = otp;
  existingData.expiresAt = Date.now() + 10 * 60 * 1000;
  existingData.attempts = 0;
  otpStore.set(key, existingData);

  await sendOTPEmail(email, otp);
  return true;
};

// Password reset OTP store (separate from registration OTP)
const passwordResetStore = new Map();

// Cleanup expired password reset OTPs
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of passwordResetStore.entries()) {
    if (now > data.expiresAt) {
      passwordResetStore.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Send password reset OTP email
 */
const sendPasswordResetOTPEmail = async (email, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"URL Shortener" <${config.smtp.from || config.smtp.user}>`,
    to: email,
    subject: 'Reset your password - URL Shortener',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d6efd;">Password Reset</h2>
        <p>You have requested to reset your password. Your verification code is:</p>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc3545;">${otp}</span>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #6c757d; font-size: 12px;">URL Shortener - Shorten your links, amplify your reach.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Request OTP for password reset
 */
const requestPasswordResetOTP = async (email) => {
  const otp = generateOTP();
  const key = email.toLowerCase();
  
  passwordResetStore.set(key, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });

  await sendPasswordResetOTPEmail(email, otp);
  return true;
};

/**
 * Verify password reset OTP
 */
const verifyPasswordResetOTP = (email, inputOTP, clearOnSuccess = true) => {
  const key = email.toLowerCase();
  const data = passwordResetStore.get(key);

  if (!data) {
    return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
  }

  if (Date.now() > data.expiresAt) {
    passwordResetStore.delete(key);
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }

  data.attempts += 1;

  if (data.attempts > 5) {
    passwordResetStore.delete(key);
    return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
  }

  if (data.otp !== inputOTP) {
    passwordResetStore.set(key, data);
    return { valid: false, error: 'Invalid OTP. Please try again.' };
  }

  // OTP is valid
  if (clearOnSuccess) {
    passwordResetStore.delete(key);
  }

  return { valid: true };
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  storeOTP,
  verifyOTP,
  requestRegistrationOTP,
  resendOTP,
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
};
