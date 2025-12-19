/**
 * Not Found Page Component
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiHome } from 'react-icons/fi';

const NotFound = () => {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 text-center">
          <FiAlertCircle size={80} className="text-muted mb-4" />
          <h1 className="display-4 fw-bold mb-3">404</h1>
          <h2 className="mb-4">Page Not Found</h2>
          <p className="text-muted mb-4">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/" className="btn btn-primary">
            <FiHome className="me-2" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
