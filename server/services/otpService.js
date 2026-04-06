/**
 * OTP Service
 * Handles OTP generation and email sending using Resend
 */

const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('../config');

// Initialize Resend client
const resend = new Resend(config.resend.apiKey);

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
 * Send OTP email using Resend
 */
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: config.resend.from,
    to: email,
    subject: '🔐 Verify your email - URL Shortener',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
          <div style="margin-bottom: 30px;">
            <h1 style="color: #0d6efd; margin: 0; font-size: 28px;">🔐 Email Verification</h1>
          </div>
          
          <p style="color: #495057; font-size: 16px; margin: 20px 0;">
            Your verification code is ready. This code will expire in <strong>10 minutes</strong>.
          </p>
          
          <div style="background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%); padding: 30px; border-radius: 8px; margin: 30px 0;">
            <p style="color: white; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Your Code</p>
            <span style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: white; display: block; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
          
          <p style="color: #6c757d; font-size: 14px; margin: 20px 0;">
            If you didn't request this verification, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 2px solid #e9ecef; margin: 30px 0;">
          
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            &copy; 2024 URL Shortener. All rights reserved.<br>
            <a href="${config.clientUrl}" style="color: #0d6efd; text-decoration: none;">Shorten your links, amplify your reach.</a>
          </p>
        </div>
      </div>
    `,
  };

  const response = await resend.emails.send(mailOptions);
  
  if (response.error) {
    throw new Error(`Failed to send email: ${response.error.message}`);
  }
  
  return response;
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
 * Send password reset OTP email using Resend
 */
const sendPasswordResetOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: config.resend.from,
    to: email,
    subject: '🔑 Reset your password - URL Shortener',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
          <div style="margin-bottom: 30px;">
            <h1 style="color: #dc3545; margin: 0; font-size: 28px;">🔑 Password Reset</h1>
          </div>
          
          <p style="color: #495057; font-size: 16px; margin: 20px 0;">
            You requested to reset your password. Use the code below to complete the process. This code will expire in <strong>10 minutes</strong>.
          </p>
          
          <div style="background: linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%); padding: 30px; border-radius: 8px; margin: 30px 0;">
            <p style="color: white; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Reset Code</p>
            <span style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: white; display: block; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: left;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>⚠️ Security reminder:</strong> Never share this code with anyone. Our team will never ask for your reset code.
            </p>
          </div>
          
          <p style="color: #6c757d; font-size: 14px; margin: 20px 0;">
            If you didn't request this password reset, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 2px solid #e9ecef; margin: 30px 0;">
          
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            &copy; 2024 URL Shortener. All rights reserved.<br>
            <a href="${config.clientUrl}" style="color: #dc3545; text-decoration: none;">Shorten your links, amplify your reach.</a>
          </p>
        </div>
      </div>
    `,
  };

  const response = await resend.emails.send(mailOptions);
  
  if (response.error) {
    throw new Error(`Failed to send email: ${response.error.message}`);
  }
  
  return response;
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
