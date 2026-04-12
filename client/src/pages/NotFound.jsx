/**
 * Not Found Page Component
 * Shows when a short URL is not found or expired
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  const location = useLocation();
  const isExpired = location.search.includes('expired=true');

  return (
    <div className="notfound-container">
      <div className="notfound-content">
        <div className="notfound-icon">🔗</div>
        
        <h1 className="notfound-code">404</h1>
        
        <h2 className="notfound-title">
          {isExpired ? 'Oops! This link has expired.' : 'Oops! That link doesn\'t seem to exist.'}
        </h2>
        
        <p className="notfound-message">
          {isExpired
            ? 'The short URL has expired and is no longer available. Please ask the person who shared this link to create a new one.'
            : 'The short URL you\'re looking for might have been deleted, expired, or never existed. Don\'t worry, we can help you get back on track.'}
        </p>

        <div className="notfound-actions">
          <Link to="/" className="notfound-btn notfound-btn-primary">
            🏠 Go Home
          </Link>
          <button 
            onClick={() => window.history.back()} 
            className="notfound-btn notfound-btn-secondary"
          >
            ← Go Back
          </button>
        </div>

        <div className="notfound-help">
          <p className="notfound-help-text">
            Having trouble? <Link to="/">Return to the homepage</Link> or contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
