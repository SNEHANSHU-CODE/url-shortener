/**
 * Protected Route Component
 * Redirects unauthenticated users to login (or allows guest access)
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';
import { LoadingSpinner } from '../components/common';

const ProtectedRoute = ({ children, allowGuest = false }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, guestId } = useAuth();

  if (isLoading) {
    return <LoadingSpinner text="Checking authentication..." />;
  }

  // Check both context state and localStorage for guest ID (handles async state updates)
  const hasGuestAccess = guestId || localStorage.getItem('guestId');

  // Allow access if authenticated OR if guest access is allowed and guest has ID
  if (isAuthenticated || (allowGuest && hasGuestAccess)) {
    return children;
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
};

export default ProtectedRoute;
