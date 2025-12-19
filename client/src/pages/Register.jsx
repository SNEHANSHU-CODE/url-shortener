/**
 * Register Page Component with OTP Verification
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiUserPlus, FiArrowLeft, FiRefreshCw, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context';
import { Alert } from '../components/common';
import api from '../services/api';
import { authService } from '../services';

const Register = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, clearError, initGuest, guestId } = useAuth();

  // Registration steps: 'form' -> 'otp'
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [googleError, setGoogleError] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const otpInputRefs = useRef([]);

  // Password validation
  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Validate form fields
  const validate = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (!isPasswordValid) {
      errors.password = 'Password does not meet all requirements';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError('');
    setSuccessMessage('');
    
    // Clear field-specific error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (error) {
      clearError();
    }
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otpValues];
    newOtp[index] = value.slice(-1); // Only take last digit
    setOtpValues(newOtp);
    setFormError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Handle backspace - focus previous input
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

    // Focus last filled input or the next empty one
    const focusIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    // Validate all fields first
    if (!validate()) {
      return;
    }

    setIsSending(true);
    setFormError('');

    try {
      await api.post('/auth/send-otp', {
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });
      
      setStep('otp');
      setResendTimer(60);
      setSuccessMessage('OTP sent to your email. Please check your inbox.');
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsSending(false);
    }
  };

  // Verify OTP and complete registration
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    const otp = otpValues.join('');
    if (otp.length !== 6) {
      setFormError('Please enter the complete 6-digit OTP');
      return;
    }

    setIsSending(true);
    setFormError('');

    try {
      const response = await api.post('/auth/verify-otp', {
        email: formData.email,
        otp,
      });
      
      // Store tokens
      localStorage.setItem('accessToken', response.data.data.accessToken);
      // Clear guest ID since URLs are migrated
      localStorage.removeItem('guestId');
      
      // Save credentials to browser's credential manager
      if (window.PasswordCredential && navigator.credentials) {
        try {
          const cred = new window.PasswordCredential({
            id: formData.email,
            password: formData.password,
            name: formData.name,
          });
          await navigator.credentials.store(cred);
        } catch (err) {
          console.log('Credential storage not supported:', err);
        }
      }
      
      // Check if URLs were migrated
      const migratedUrls = response.data.data.migratedUrls || 0;
      if (migratedUrls > 0) {
        // Store migration message for dashboard to display
        sessionStorage.setItem('migrationMessage', 
          `Welcome! ${migratedUrls} guest URL${migratedUrls > 1 ? 's have' : ' has'} been added to your account.`
        );
      }
      
      window.location.href = '/dashboard'; // Force reload to update auth state
    } catch (err) {
      setFormError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setIsSending(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    setIsSending(true);
    setFormError('');

    try {
      await api.post('/auth/resend-otp', { email: formData.email });
      setResendTimer(60);
      setSuccessMessage('New OTP sent successfully!');
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setIsSending(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setGoogleError('');
        // Send the access token to backend for verification
        const response = await authService.googleLogin(tokenResponse.access_token);
        
        if (response.success) {
          // Store tokens
          localStorage.setItem('accessToken', response.data.accessToken);
          
          // Navigate to dashboard
          navigate('/dashboard');
          window.location.reload(); // Refresh to update auth state
        }
      } catch (err) {
        console.error('Google login error:', err);
        setGoogleError(err.response?.data?.error?.message || 'Google login failed. Please try again.');
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setGoogleError('Google login failed. Please try again.');
    },
  });

  const handleGuestAccess = async () => {
    // Initialize guest session and redirect to dashboard
    let currentGuestId = guestId;
    if (!currentGuestId) {
      currentGuestId = await initGuest();
    }
    // Only navigate if we have a guest ID
    if (currentGuestId) {
      // Small delay to ensure state is updated
      setTimeout(() => navigate('/dashboard'), 100);
    }
  };

  const displayError = formError || error;

  // OTP Verification Step
  if (step === 'otp') {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="card shadow-sm">
              <div className="card-body p-5">
                <button
                  type="button"
                  className="btn btn-link text-decoration-none p-0 mb-4"
                  onClick={() => {
                    setStep('form');
                    setOtpValues(['', '', '', '', '', '']);
                  }}
                >
                  <FiArrowLeft className="me-1" />
                  Back
                </button>

                <div className="text-center mb-4">
                  <h2 className="fw-bold">Verify Email</h2>
                  <p className="text-muted">
                    Enter the 6-digit code sent to<br />
                    <strong>{formData.email}</strong>
                  </p>
                </div>

                {displayError && (
                  <Alert
                    type="danger"
                    message={displayError}
                    onClose={() => setFormError('')}
                    className="mb-4"
                  />
                )}

                {successMessage && (
                  <Alert
                    type="success"
                    message={successMessage}
                    onClose={() => setSuccessMessage('')}
                    className="mb-4"
                  />
                )}

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
                    disabled={isSending || otpValues.join('').length !== 6}
                  >
                    {isSending ? (
                      <span className="spinner-border spinner-border-sm me-2" />
                    ) : null}
                    Verify & Create Account
                  </button>
                </form>

                <div className="text-center">
                  <p className="text-muted mb-2">Didn't receive the code?</p>
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none p-0"
                    onClick={handleResendOTP}
                    disabled={resendTimer > 0 || isSending}
                  >
                    <FiRefreshCw className="me-1" />
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration Form Step
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <h2 className="fw-bold">Create Account</h2>
                <p className="text-muted">Start shortening your links today</p>
              </div>

              {displayError && (
                <Alert
                  type="danger"
                  message={displayError}
                  onClose={() => {
                    setFormError('');
                    clearError();
                  }}
                  className="mb-4"
                />
              )}

              <form onSubmit={handleSendOTP} autoComplete="on">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Name</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <FiUser className="text-muted" />
                    </span>
                    <input
                      type="text"
                      name="name"
                      className={`form-control ${fieldErrors.name ? 'is-invalid' : ''}`}
                      placeholder="Your name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={isSending}
                    />
                  </div>
                  {fieldErrors.name && (
                    <div className="invalid-feedback d-block">
                      {fieldErrors.name}
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Email Address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <FiMail className="text-muted" />
                    </span>
                    <input
                      type="email"
                      name="email"
                      className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isSending}
                    />
                  </div>
                  {fieldErrors.email && (
                    <div className="invalid-feedback d-block">
                      {fieldErrors.email}
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <FiLock className="text-muted" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                      placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={isSending}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      disabled={isSending}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <div className="invalid-feedback d-block">
                      {fieldErrors.password}
                    </div>
                  )}
                  {/* Password Requirements */}
                  {formData.password && (
                    <div className="mt-2">
                      <small className="text-muted">Password must contain:</small>
                      <ul className="list-unstyled small mt-1 mb-0">
                        <li className={passwordChecks.length ? 'text-success' : 'text-danger'}>
                          <FiCheck className="me-1" /> At least 8 characters
                        </li>
                        <li className={passwordChecks.uppercase ? 'text-success' : 'text-danger'}>
                          <FiCheck className="me-1" /> One uppercase letter (A-Z)
                        </li>
                        <li className={passwordChecks.lowercase ? 'text-success' : 'text-danger'}>
                          <FiCheck className="me-1" /> One lowercase letter (a-z)
                        </li>
                        <li className={passwordChecks.number ? 'text-success' : 'text-danger'}>
                          <FiCheck className="me-1" /> One number (0-9)
                        </li>
                        <li className={passwordChecks.special ? 'text-success' : 'text-danger'}>
                          <FiCheck className="me-1" /> One special character (!@#$%^&*)
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold">Confirm Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <FiLock className="text-muted" />
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      className={`form-control ${fieldErrors.confirmPassword || (formData.confirmPassword && formData.password !== formData.confirmPassword) ? 'is-invalid' : ''}`}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={isSending}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      disabled={isSending}
                    >
                      {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <div className="invalid-feedback d-block">
                      {fieldErrors.confirmPassword}
                    </div>
                  )}
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && !fieldErrors.confirmPassword && (
                    <div className="invalid-feedback d-block">
                      Passwords do not match
                    </div>
                  )}
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2"
                  disabled={isLoading || isSending || !isPasswordValid}
                >
                  {isSending ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <FiUserPlus className="me-2" />
                  )}
                  Continue
                </button>
              </form>

              <hr className="my-4" />

              <div className="d-flex align-items-center mb-3">
                <hr className="flex-grow-1" />
                <span className="px-3 text-muted small">or continue with</span>
                <hr className="flex-grow-1" />
              </div>

              {/* Google OAuth Error */}
              {googleError && (
                <div className="alert alert-warning py-2 mb-3" role="alert">
                  <strong>Google Error:</strong> {googleError}
                </div>
              )}

              {/* Google OAuth Button */}
              <button
                type="button"
                className="btn btn-outline-secondary w-100 py-2 mb-3 d-flex align-items-center justify-content-center"
                onClick={() => {
                  setGoogleError('');
                  handleGoogleLogin();
                }}
                disabled={isLoading || isSending}
              >
                <FcGoogle className="me-2" size={20} />
                Continue with Google
              </button>

              {/* Guest Access Button */}
              <button
                type="button"
                className="btn btn-outline-primary w-100 py-2"
                onClick={handleGuestAccess}
                disabled={isLoading || isSending}
              >
                <FiUser className="me-2" />
                Try as Guest
              </button>
              <p className="text-center text-muted small mt-2 mb-0">
                Guest links expire after 7 days
              </p>

              <hr className="my-4" />

              <p className="text-center mb-0">
                Already have an account?{' '}
                <Link to="/login" className="text-decoration-none fw-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
