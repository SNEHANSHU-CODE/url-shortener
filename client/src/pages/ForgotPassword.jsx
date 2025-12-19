/**
 * Forgot Password Page Component
 * OTP-based password reset flow
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiArrowLeft, FiRefreshCw, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import { Alert } from '../components/common';
import api from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Steps: 'email' -> 'otp' -> 'reset'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [passwords, setPasswords] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRefs = useRef([]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Password validation
  const passwordChecks = {
    length: passwords.password.length >= 8,
    uppercase: /[A-Z]/.test(passwords.password),
    lowercase: /[a-z]/.test(passwords.password),
    number: /[0-9]/.test(passwords.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(passwords.password),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpValues];
    newOtp[index] = value.slice(-1);
    setOtpValues(newOtp);
    setError('');
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;
    const newOtp = [...otpValues];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtpValues(newOtp);
    const focusIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // Step 1: Send OTP to email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password/send-otp', { email });
      setStep('otp');
      setResendTimer(60);
      setSuccessMessage('OTP sent to your email. Please check your inbox.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otp = otpValues.join('');
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password/verify-otp', { email, otp });
      setStep('reset');
      setSuccessMessage('OTP verified! Set your new password.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError('Please meet all password requirements');
      return;
    }

    if (passwords.password !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const otp = otpValues.join('');
      await api.post('/auth/forgot-password/reset', {
        email,
        otp,
        newPassword: passwords.password,
      });
      
      // Update credentials in browser's credential manager
      if (window.PasswordCredential && navigator.credentials) {
        try {
          const cred = new window.PasswordCredential({
            id: email,
            password: passwords.password,
            name: email,
          });
          await navigator.credentials.store(cred);
        } catch (err) {
          console.log('Credential storage not supported:', err);
        }
      }
      
      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password/send-otp', { email });
      setResendTimer(60);
      setSuccessMessage('New OTP sent successfully!');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-5">
              {/* Back button */}
              <Link
                to="/login"
                className="btn btn-link text-decoration-none p-0 mb-4 d-inline-flex align-items-center"
              >
                <FiArrowLeft className="me-1" />
                Back to Login
              </Link>

              {/* Step 1: Email */}
              {step === 'email' && (
                <>
                  <div className="text-center mb-4">
                    <h2 className="fw-bold">Forgot Password?</h2>
                    <p className="text-muted">Enter your email to receive a verification code</p>
                  </div>

                  {error && <Alert type="danger" message={error} onClose={() => setError('')} className="mb-4" />}

                  <form onSubmit={handleSendOTP}>
                    <div className="mb-4">
                      <label className="form-label">Email Address</label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <FiMail className="text-muted" />
                        </span>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary w-100 py-2" disabled={isLoading}>
                      {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                      Send Verification Code
                    </button>
                  </form>
                </>
              )}

              {/* Step 2: OTP Verification */}
              {step === 'otp' && (
                <>
                  <div className="text-center mb-4">
                    <h2 className="fw-bold">Verify Email</h2>
                    <p className="text-muted">
                      Enter the 6-digit code sent to<br />
                      <strong>{email}</strong>
                    </p>
                  </div>

                  {error && <Alert type="danger" message={error} onClose={() => setError('')} className="mb-4" />}
                  {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} className="mb-4" />}

                  <form onSubmit={handleVerifyOTP}>
                    <div className="d-flex justify-content-between gap-2 mb-4">
                      {otpValues.map((value, index) => (
                        <input
                          key={index}
                          ref={(el) => (otpInputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          className="form-control text-center fw-bold"
                          style={{ width: '50px', height: '50px', fontSize: '1.5rem' }}
                          value={value}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={index === 0 ? handleOtpPaste : undefined}
                          maxLength={1}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-100 py-2 mb-3"
                      disabled={isLoading || otpValues.join('').length !== 6}
                    >
                      {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                      Verify Code
                    </button>
                  </form>

                  <div className="text-center">
                    <p className="text-muted mb-2">Didn't receive the code?</p>
                    <button
                      type="button"
                      className="btn btn-link text-decoration-none p-0"
                      onClick={handleResendOTP}
                      disabled={resendTimer > 0 || isLoading}
                    >
                      <FiRefreshCw className="me-1" />
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Reset Password */}
              {step === 'reset' && (
                <>
                  <div className="text-center mb-4">
                    <h2 className="fw-bold">Set New Password</h2>
                    <p className="text-muted">Create a strong password for your account</p>
                  </div>

                  {error && <Alert type="danger" message={error} onClose={() => setError('')} className="mb-4" />}
                  {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} className="mb-4" />}

                  <form onSubmit={handleResetPassword}>
                    <div className="mb-3">
                      <label className="form-label">New Password</label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <FiLock className="text-muted" />
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-control"
                          placeholder="Enter new password"
                          value={passwords.password}
                          onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="mb-3">
                      <small className="text-muted">Password must contain:</small>
                      <ul className="list-unstyled small mt-1 mb-0">
                        <li className={passwordChecks.length ? 'text-success' : 'text-muted'}>
                          <FiCheck className="me-1" /> At least 8 characters
                        </li>
                        <li className={passwordChecks.uppercase ? 'text-success' : 'text-muted'}>
                          <FiCheck className="me-1" /> One uppercase letter (A-Z)
                        </li>
                        <li className={passwordChecks.lowercase ? 'text-success' : 'text-muted'}>
                          <FiCheck className="me-1" /> One lowercase letter (a-z)
                        </li>
                        <li className={passwordChecks.number ? 'text-success' : 'text-muted'}>
                          <FiCheck className="me-1" /> One number (0-9)
                        </li>
                        <li className={passwordChecks.special ? 'text-success' : 'text-muted'}>
                          <FiCheck className="me-1" /> One special character (!@#$%^&*)
                        </li>
                      </ul>
                    </div>

                    <div className="mb-4">
                      <label className="form-label">Confirm New Password</label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <FiLock className="text-muted" />
                        </span>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="form-control"
                          placeholder="Confirm new password"
                          value={passwords.confirmPassword}
                          onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwords.confirmPassword && passwords.password !== passwords.confirmPassword && (
                        <small className="text-danger">Passwords do not match</small>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-100 py-2"
                      disabled={isLoading || !isPasswordValid}
                    >
                      {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                      Reset Password
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
