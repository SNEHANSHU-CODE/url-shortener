/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import config from './config';

import { AuthProvider, UrlProvider, useAuth } from './context';
import { Navbar, Footer } from './components/layout';
import { LoadingSpinner } from './components/common';
import { Home, Login, Register, Dashboard, NotFound, ForgotPassword } from './pages';
import ProtectedRoute from './routes/ProtectedRoute';

// App Layout with auth check
const AppLayout = () => {
  const { isLoading } = useAuth();

  useEffect(() => {
    // Handle auth logout event from API interceptor
    const handleLogout = () => {
      window.location.href = '/login';
    };
    
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowGuest={true}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={config.googleClientId}>
      <BrowserRouter>
        <AuthProvider>
          <UrlProvider>
            <AppLayout />
          </UrlProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
