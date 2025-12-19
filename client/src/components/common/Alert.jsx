/**
 * Alert Component
 */

import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';

const Alert = ({ type = 'info', message, onClose, className = '' }) => {
  const icons = {
    success: FiCheckCircle,
    danger: FiAlertCircle,
    warning: FiAlertTriangle,
    info: FiInfo,
  };

  const Icon = icons[type] || icons.info;

  if (!message) return null;

  return (
    <div
      className={`alert alert-${type} d-flex align-items-center ${
        onClose ? 'alert-dismissible' : ''
      } ${className}`}
      role="alert"
    >
      <Icon className="me-2 flex-shrink-0" size={20} />
      <div>{message}</div>
      {onClose && (
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          aria-label="Close"
        ></button>
      )}
    </div>
  );
};

export default Alert;
