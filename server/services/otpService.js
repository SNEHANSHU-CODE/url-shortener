/**
 * OTP Service
 * Handles OTP generation and email sending using EmailJS
 */

const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('../config');

// EmailJS API endpoint
const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

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
 * Send OTP email using EmailJS
 */
const sendOTPEmail = async (email, otp) => {
  try {
    const emailData = {
      service_id: config.emailjs.serviceId,
      template_id: config.emailjs.templateId,
      user_id: config.emailjs.publicKey,
      template_params: {
        to_email: email,
        otp_code: otp,
        client_url: config.clientUrl,
      },
    };

    const response = await axios.post(EMAILJS_API_URL, emailData);

    if (response.status !== 200) {
      throw new Error(`Failed to send email. Status: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error('EmailJS Error:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
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
 * Send password reset OTP email using EmailJS
 */
const sendPasswordResetOTPEmail = async (email, otp) => {
  try {
    const emailData = {
      service_id: config.emailjs.serviceId,
      template_id: config.emailjs.templateId,
      user_id: config.emailjs.publicKey,
      template_params: {
        to_email: email,
        otp_code: otp,
        client_url: config.clientUrl,
        purpose: 'Password Reset',
      },
    };

    const response = await axios.post(EMAILJS_API_URL, emailData);

    if (response.status !== 200) {
      throw new Error(`Failed to send email. Status: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error('EmailJS Error:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Request password reset OTP
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
