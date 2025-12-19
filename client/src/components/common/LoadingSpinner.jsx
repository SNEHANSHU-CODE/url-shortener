/**
 * Loading Spinner Component
 */

import React from 'react';

const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  const sizeClass = {
    sm: 'spinner-border-sm',
    md: '',
    lg: 'spinner-border',
  }[size];

  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5">
      <div className={`spinner-border text-primary ${sizeClass}`} role="status">
        <span className="visually-hidden">{text}</span>
      </div>
      {text && <p className="mt-3 text-muted">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
