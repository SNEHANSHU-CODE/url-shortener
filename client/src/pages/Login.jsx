/**
 * Login Page Component
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiLogIn, FiEye, FiEyeOff, FiUser } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context';
import { Alert } from '../components/common';

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, login, googleLogin, clearError, initGuest, guestId } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [googleError, setGoogleError] = useState('');

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear field-specific error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validate form fields
  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/;

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    const result = await login(formData);
    
    if (result.success) {
      // Save credentials to browser's credential manager
      if (window.PasswordCredential && navigator.credentials) {
        try {
          const cred = new window.PasswordCredential({
            id: formData.email,
            password: formData.password,
            name: formData.email,
          });
          await navigator.credentials.store(cred);
        } catch (err) {
          // Credential storage not supported or failed
        }
      }
      
      if (result.migratedUrls > 0) {
        setSuccessMessage(`Welcome back! ${result.migratedUrls} guest URL${result.migratedUrls > 1 ? 's' : ''} migrated to your account.`);
      }
      
      // Redirect to dashboard after successful login
      setTimeout(() => navigate('/dashboard'), 100);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setGoogleError('');
        console.log('Google token received, sending to backend...');
        // Use context's googleLogin method which updates auth state
        const result = await googleLogin(tokenResponse.access_token);
        
        console.log('Google login result:', result);
        
        if (result.success) {
          // Auth context will handle state update
          // Redirect to dashboard
          navigate('/dashboard');
        } else {
          // Error already set in context, will be displayed
          setGoogleError(result.error);
        }
      } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.message || 'Google login failed. Please try again.';
        console.error('Google login error:', err);
        setGoogleError(errorMsg);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setGoogleError(error?.error || 'Google login failed. Please try again.');
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
      setTimeout(() => navigate('/dashboard'), 100);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <h2 className="fw-bold">Welcome Back</h2>
                <p className="text-muted">Sign in to manage your links</p>
              </div>

              {error && (
                <Alert
                  type="danger"
                  message={error}
                  onClose={clearError}
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

              <form onSubmit={handleSubmit} autoComplete="on">
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
                      disabled={isLoading}
                    />
                  </div>
                  {fieldErrors.email && (
                    <div className="invalid-feedback d-block">
                      {fieldErrors.email}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label fw-semibold mb-0">Password</label>
                    <Link
                      to="/forgot-password"
                      className="text-decoration-none small"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="input-group mt-2">
                    <span className="input-group-text bg-light">
                      <FiLock className="text-muted" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      disabled={isLoading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <div className="invalid-feedback d-block">
                      {fieldErrors.password}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2"
                  disabled={isLoading}
                  aria-label="Sign in to your account"
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <FiLogIn className="me-2" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div className="d-flex align-items-center my-4">
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
                disabled={isLoading}
                aria-label="Sign in with Google account"
              >
                <FcGoogle className="me-2" size={20} />
                Continue with Google
              </button>

              {/* Guest Access Button */}
              <button
                type="button"
                className="btn btn-outline-primary w-100 py-2 d-flex align-items-center justify-content-center"
                onClick={handleGuestAccess}
                disabled={isLoading}
                aria-label="Continue as guest"
              >
                <FiUser className="me-2" />
                Try as Guest
              </button>
              <p className="text-center text-muted small mt-2 mb-0">
                Guest links expire after 7 days
              </p>

              <hr className="my-4" />

              <p className="text-center mb-0">
                Don't have an account?{' '}
                <Link to="/register" className="text-decoration-none fw-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
