/**
 * Dashboard Page Component
 * Authenticated user's or guest's dashboard
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiLink, FiBarChart2, FiPlus, FiSearch, FiUserPlus, FiTrash2, FiX } from 'react-icons/fi';
import { UrlForm, UrlList } from '../components/url';
import { Alert, ConfirmModal } from '../components/common';
import { useAuth, useUrls } from '../context';
import { authService } from '../services';

const Dashboard = () => {
  const { user, isAuthenticated, guestId, initGuest, logout } = useAuth();
  const { urls, isLoading, pagination, fetchUserUrls, fetchGuestUrls, clearUrls } = useUrls();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [migrationMessage, setMigrationMessage] = useState('');
  
  // Search state
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Delete account state
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  // Check if in guest mode
  const isGuest = !isAuthenticated && (guestId || localStorage.getItem('guestId'));
  const currentGuestId = guestId || localStorage.getItem('guestId');

  // Check for migration message from registration
  useEffect(() => {
    const message = sessionStorage.getItem('migrationMessage');
    if (message) {
      setMigrationMessage(message);
      sessionStorage.removeItem('migrationMessage');
    }
  }, []);

  // Initialize guest session if needed
  useEffect(() => {
    if (!isAuthenticated && !guestId && !localStorage.getItem('guestId')) {
      initGuest();
    }
  }, [isAuthenticated, guestId, initGuest]);

  const loadUrls = useCallback(() => {
    if (isAuthenticated) {
      fetchUserUrls({ page: currentPage, limit: 10 });
    } else if (currentGuestId) {
      // Only fetch guest URLs when we have a valid guest ID
      fetchGuestUrls();
    }
  }, [fetchUserUrls, fetchGuestUrls, currentPage, isAuthenticated, currentGuestId]);

  useEffect(() => {
    loadUrls();
    
    return () => {
      clearUrls();
    };
  }, [loadUrls, clearUrls]);

  // Search handler - only search when button is clicked
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    
    setIsSearching(true);
    const query = searchQuery.toLowerCase().trim();
    
    // Filter URLs based on originalUrl and shortCode
    const filtered = urls.filter(url => 
      url.originalUrl.toLowerCase().includes(query) ||
      url.shortCode.toLowerCase().includes(query) ||
      url.shortUrl?.toLowerCase().includes(query)
    );
    
    setSearchResults(filtered);
    setIsSearching(false);
  };

  // Clear search results
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  // Delete account handler (password)
  const handleDeleteAccount = async ({ password }) => {
    try {
      setDeleteAccountError('');
      await authService.deleteAccount(password, 'DELETE');
      logout();
      navigate('/');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete account';
      setDeleteAccountError(message);
      throw new Error(message);
    }
  };

  // Delete account handler (Google) - no type DELETE required
  const handleDeleteAccountWithGoogle = async ({ accessToken }) => {
    try {
      setDeleteAccountError('');
      await authService.deleteAccountWithGoogle(accessToken);
      logout();
      navigate('/');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete account';
      setDeleteAccountError(message);
      throw new Error(message);
    }
  };

  const handleUrlCreated = () => {
    setShowForm(false);
    setCurrentPage(1);
    setSearchQuery('');
  };

  // Calculate stats
  const totalLinks = pagination?.total || urls.length;
  const totalClicks = urls.reduce((sum, url) => sum + (url.clicks || 0), 0);

  return (
    <div className="container py-4">
      {/* Migration Success Message */}
      {migrationMessage && (
        <Alert
          type="success"
          message={migrationMessage}
          onClose={() => setMigrationMessage('')}
          className="mb-4"
        />
      )}

      {/* Guest Mode Banner */}
      {isGuest && (
        <div className="alert alert-info d-flex justify-content-between align-items-center mb-4">
          <span>
            <strong>Guest Mode:</strong> Your links are temporary. Sign up to save them permanently!
          </span>
          <Link to="/register" className="btn btn-primary btn-sm">
            <FiUserPlus className="me-1" />
            Sign Up Free
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="fw-bold mb-1">
            Welcome{isGuest ? ', Guest' : ` back, ${user?.name || 'User'}`}!
          </h2>
          <p className="text-muted">
            {isGuest 
              ? 'Create and manage your shortened links (links expire after 7 days)'
              : 'Manage and track your shortened links'
            }
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card bg-primary text-white h-100">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-white bg-opacity-25 p-3 me-3">
                <FiLink size={24} />
              </div>
              <div>
                <h3 className="mb-0 fw-bold">{totalLinks}</h3>
                <small className="opacity-75">Total Links</small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-success text-white h-100">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-white bg-opacity-25 p-3 me-3">
                <FiBarChart2 size={24} />
              </div>
              <div>
                <h3 className="mb-0 fw-bold">{totalClicks}</h3>
                <small className="opacity-75">Total Clicks</small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <button
            className="btn btn-outline-primary w-100 h-100 d-flex align-items-center justify-content-center"
            onClick={() => setShowForm(!showForm)}
          >
            <FiPlus className="me-2" size={24} />
            <span className="fw-medium">Create New Link</span>
          </button>
        </div>
      </div>

      {/* URL Form */}
      {showForm && (
        <div className="row mb-4">
          <div className="col-12">
            <UrlForm onSuccess={handleUrlCreated} />
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="row mb-4">
        <div className="col-md-6">
          <form onSubmit={handleSearch}>
            <div className="input-group">
              <span className="input-group-text bg-white">
                <FiSearch className="text-muted" />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search by URL or short code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults !== null && (
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={clearSearch}
                  title="Clear search"
                >
                  <FiX />
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Search Results (Separate from main list) */}
      {searchResults !== null && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card shadow-sm border-primary">
              <div className="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-medium">
                  <FiSearch className="me-2" />
                  Search Results ({searchResults.length} found)
                </h5>
                <button 
                  className="btn btn-sm btn-light"
                  onClick={clearSearch}
                >
                  Clear Search
                </button>
              </div>
              <div className="card-body">
                <UrlList
                  urls={searchResults}
                  isLoading={false}
                  showActions={true}
                  emptyMessage={`No links found matching "${searchQuery}"`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL List */}
      <div className="row">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-medium">Your Links</h5>
            </div>
            <div className="card-body">
              <UrlList
                urls={urls}
                isLoading={isLoading}
                showActions={true}
                emptyMessage="You haven't created any links yet"
              />
            </div>

            {/* Pagination - Only show when total > 10 */}
            {pagination && pagination.total > 10 && pagination.pages > 1 && (
              <div className="card-footer bg-white">
                <nav>
                  <ul className="pagination mb-0 justify-content-center">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                    </li>
                    {[...Array(pagination.pages)].map((_, i) => (
                      <li
                        key={i + 1}
                        className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${currentPage === pagination.pages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === pagination.pages}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone - Delete Account (Only for authenticated users) */}
      {isAuthenticated && (
        <div className="row mt-5">
          <div className="col-12">
            <div className="card border-danger">
              <div className="card-header bg-danger text-white">
                <h5 className="mb-0 fw-medium">
                  <FiTrash2 className="me-2" />
                  Danger Zone
                </h5>
              </div>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">Delete Account</h6>
                    <p className="text-muted mb-0 small">
                      Permanently delete your account and all associated links. This action cannot be undone.
                    </p>
                  </div>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => setShowDeleteAccountModal(true)}
                  >
                    <FiTrash2 className="me-sm-1" />
                    <span className="d-none d-sm-inline">Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      <ConfirmModal
        isOpen={showDeleteAccountModal}
        onClose={() => {
          setShowDeleteAccountModal(false);
          setDeleteAccountError('');
        }}
        onConfirm={handleDeleteAccount}
        onGoogleConfirm={handleDeleteAccountWithGoogle}
        title="Delete Account"
        message={
          <>
            <p className="mb-2">
              <strong>Are you absolutely sure?</strong>
            </p>
            <p className="mb-0" style={{ fontSize: '0.95rem' }}>
              This will permanently delete your account and all {totalLinks} link{totalLinks !== 1 ? 's' : ''}.
              This action <strong>cannot be undone</strong>.
            </p>
          </>
        }
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        confirmationType="type-to-confirm"
        confirmationWord="DELETE"
        requirePassword={true}
        showGoogleOption={true}
        error={deleteAccountError}
      />
    </div>
  );
};

export default Dashboard;
