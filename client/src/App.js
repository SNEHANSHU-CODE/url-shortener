/**
 * Main App Component
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import config from './config';

import { AuthProvider, UrlProvider } from './context';
import { Navbar, Footer } from './components/layout';
import { Home, Login, Register, Dashboard, NotFound, ForgotPassword } from './pages';
import ProtectedRoute from './routes/ProtectedRoute';

// App Layout with auth check
const AppLayout = () => {
  // Auth state managed by ProtectedRoute for redirects
  // Don't show spinner on initial load - show Content while checking auth
  // The ProtectedRoute will handle redirects if needed

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
          <Route path="/notfound" element={<NotFound />} />
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
