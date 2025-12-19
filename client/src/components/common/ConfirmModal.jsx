/**
 * Enterprise-standard Confirmation Modal Component
 * Supports different confirmation types: simple, password, and type-to-confirm
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FiAlertTriangle, FiTrash2, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useGoogleLogin } from '@react-oauth/google';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  onGoogleConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger', 'warning', 'info'
  confirmationType = 'simple', // 'simple', 'password', 'type-to-confirm'
  confirmationWord = 'DELETE',
  requirePassword = false,
  showGoogleOption = false,
  isLoading = false,
  icon = null,
  error: externalError = '',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [typeConfirmation, setTypeConfirmation] = useState('');
  const [internalError, setInternalError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const modalRef = useRef(null);
  const passwordInputRef = useRef(null);
  const typeInputRef = useRef(null);
  
  // Combine external and internal errors
  const error = externalError || internalError;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setTypeConfirmation('');
      setInternalError('');
      setIsGoogleLoading(false);
      // Focus first input after modal opens
      setTimeout(() => {
        if (requirePassword || confirmationType === 'password') {
          passwordInputRef.current?.focus();
        } else if (confirmationType === 'type-to-confirm') {
          typeInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, requirePassword, confirmationType]);

  // Google login for verification - No type DELETE required for Google users
  const handleGoogleVerify = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setInternalError('');
      try {
        // For Google users, no need to type DELETE - Google verification is enough
        await onGoogleConfirm({ accessToken: tokenResponse.access_token });
      } catch (err) {
        setInternalError(err.message || 'Google verification failed');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setInternalError('Google verification failed. Please try again.');
      setIsGoogleLoading(false);
    },
  });

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    setInternalError('');

    // Validate type-to-confirm
    if (confirmationType === 'type-to-confirm') {
      if (typeConfirmation !== confirmationWord) {
        setInternalError(`Please type "${confirmationWord}" to confirm`);
        return;
      }
    }

    // Validate password
    if (confirmationType === 'password' || requirePassword) {
      if (!password.trim()) {
        setInternalError('Password is required');
        return;
      }
    }

    try {
      await onConfirm({ password, typeConfirmation });
    } catch (err) {
      setInternalError(err.message || 'An error occurred');
    }
  };

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      headerBg: 'bg-danger',
      iconBg: 'bg-danger bg-opacity-10',
      iconColor: 'text-danger',
      buttonClass: 'btn-danger',
    },
    warning: {
      headerBg: 'bg-warning',
      iconBg: 'bg-warning bg-opacity-10',
      iconColor: 'text-warning',
      buttonClass: 'btn-warning',
    },
    info: {
      headerBg: 'bg-primary',
      iconBg: 'bg-primary bg-opacity-10',
      iconColor: 'text-primary',
      buttonClass: 'btn-primary',
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;
  const IconComponent = icon || (variant === 'danger' ? FiTrash2 : FiAlertTriangle);

  // Use Portal to render modal at document body level to prevent flickering
  return ReactDOM.createPortal(
    <div
      ref={modalRef}
      className="confirm-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        overflowY: 'auto',
      }}
      onClick={handleBackdropClick}
    >
      <div 
        className="confirm-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fff' }}>
          {/* Header */}
          <div className={`modal-header border-0 ${styles.headerBg} text-white`} style={{ padding: '1rem 1.5rem' }}>
            <h5 className="modal-title d-flex align-items-center">
              <IconComponent className="me-2" />
              {title}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isLoading}
            />
          </div>

          {/* Body */}
          <div className="modal-body" style={{ padding: '1.5rem 1.25rem' }}>
            {/* Warning Icon */}
            <div className="text-center mb-3">
              <div
                className={`d-inline-flex align-items-center justify-content-center rounded-circle ${styles.iconBg} p-3`}
                style={{ width: '70px', height: '70px' }}
              >
                <IconComponent size={32} className={styles.iconColor} />
              </div>
            </div>

            {/* Message */}
            <div className="text-center mb-3">
              <p className="mb-0 text-muted" style={{ fontSize: '1rem' }}>
                {message}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="alert alert-danger py-2 mb-3">
                <small>{error}</small>
              </div>
            )}

            {/* Password input - FIRST */}
            {(confirmationType === 'password' || requirePassword) && (
              <div className="mb-3">
                <label className="form-label text-muted small d-flex align-items-center">
                  <FiLock className="me-1" />
                  Enter your password to confirm:
                </label>
                <div className="position-relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    className="form-control pe-5"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Type your password"
                    disabled={isLoading}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted pe-3"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{ zIndex: 10 }}
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Type to confirm input - SECOND */}
            {confirmationType === 'type-to-confirm' && (
              <div className="mb-3">
                <label className="form-label text-muted small">
                  Type <strong className="text-danger">{confirmationWord}</strong> to confirm:
                </label>
                <input
                  ref={typeInputRef}
                  type="text"
                  className="form-control"
                  value={typeConfirmation}
                  onChange={(e) => setTypeConfirmation(e.target.value.toUpperCase())}
                  placeholder={`Type ${confirmationWord} here`}
                  disabled={isLoading || isGoogleLoading}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                />
              </div>
            )}

            {/* Action Buttons - Only shown when Google option is available */}
            {showGoogleOption && (
              <>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3 flex-grow-1"
                    onClick={onClose}
                    disabled={isLoading || isGoogleLoading}
                  >
                    {cancelText}
                  </button>
                  <button
                    type="button"
                    className={`btn ${styles.buttonClass} px-3 flex-grow-1`}
                    onClick={handleConfirm}
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Processing...
                      </>
                    ) : (
                      confirmText
                    )}
                  </button>
                </div>

                {/* Google Option Divider */}
                <div className="mt-3">
                  <div className="d-flex align-items-center mb-3">
                    <hr className="flex-grow-1" />
                    <span className="px-3 text-muted small">or</span>
                    <hr className="flex-grow-1" />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center py-2"
                    onClick={() => handleGoogleVerify()}
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Verifying with Google...
                      </>
                    ) : (
                      <>
                        <FcGoogle size={20} className="me-2" />
                        Delete with Google
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer - Only show when no Google option */}
          {!showGoogleOption && (
          <div className="modal-footer border-0 flex-wrap" style={{ padding: '1rem 1.25rem', paddingTop: '0', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline-secondary px-3 flex-grow-1 flex-sm-grow-0"
              onClick={onClose}
              disabled={isLoading || isGoogleLoading}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`btn ${styles.buttonClass} px-3 flex-grow-1 flex-sm-grow-0`}
              onClick={handleConfirm}
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
