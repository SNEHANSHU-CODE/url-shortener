/**
 * URL Form Component
 * For creating short URLs
 */

import React, { useState } from 'react';
import { FiLink, FiLoader, FiCopy, FiCheck, FiClock } from 'react-icons/fi';
import { useAuth, useUrls } from '../../context';
import { Alert } from '../common';

const UrlForm = ({ onSuccess }) => {
  const { isAuthenticated } = useAuth();
  const { isCreating, error, createSuccess, lastCreatedUrl, createUrl, clearError, clearSuccess } = useUrls();

  const [formData, setFormData] = useState({
    originalUrl: '',
    customSlug: '',
    expiresAt: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (lastCreatedUrl?.shortUrl) {
      try {
        await navigator.clipboard.writeText(lastCreatedUrl.shortUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      originalUrl: formData.originalUrl,
    };
    
    if (formData.customSlug.trim()) {
      data.customSlug = formData.customSlug.trim();
    }
    
    if (formData.expiresAt) {
      data.expiresAt = new Date(formData.expiresAt).toISOString();
    }

    const result = await createUrl(data);
    
    if (result.success) {
      setFormData({ originalUrl: '', customSlug: '', expiresAt: '' });
      setShowAdvanced(false);
      if (onSuccess) {
        onSuccess(result.url);
      }
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert
              type="danger"
              message={error}
              onClose={clearError}
              className="mb-3"
            />
          )}

          {lastCreatedUrl && createSuccess && (
            <Alert
              type="success"
              message={
                <div>
                  <strong>URL shortened successfully!</strong>
                  <div className="mt-2 d-flex align-items-center gap-2">
                    <a
                      href={lastCreatedUrl.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-success"
                    >
                      {lastCreatedUrl.shortUrl}
                    </a>
                    <button
                      type="button"
                      className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={handleCopyLink}
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <>
                          <FiCheck className="me-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <FiCopy className="me-1" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              }
              onClose={clearSuccess}
              className="mb-3"
            />
          )}

          <div className="input-group input-group-lg mb-3">
            <span className="input-group-text bg-white">
              <FiLink className="text-primary" />
            </span>
            <input
              type="url"
              name="originalUrl"
              className="form-control"
              placeholder="Paste your long URL here..."
              value={formData.originalUrl}
              onChange={handleChange}
              required
            />
            <button
              type="submit"
              className="btn btn-primary px-4"
              disabled={isCreating || !formData.originalUrl}
            >
              {isCreating ? (
                <FiLoader className="spin" />
              ) : (
                'Shorten'
              )}
            </button>
          </div>

          <div className="mb-2">
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '− Hide options' : '+ Advanced options'}
            </button>
          </div>

          {showAdvanced && (
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small text-muted">Custom Alias</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text text-muted">
                    {window.location.origin}/
                  </span>
                  <input
                    type="text"
                    name="customSlug"
                    className="form-control"
                    placeholder="custom-alias"
                    value={formData.customSlug}
                    onChange={handleChange}
                    pattern="^[a-zA-Z0-9_-]+$"
                    title="Only letters, numbers, hyphens, and underscores"
                  />
                </div>
                <small className="text-muted">
                  Leave empty for auto-generated code
                </small>
              </div>
              
              {isAuthenticated && (
                <div className="col-md-6">
                  <label className="form-label small text-muted">
                    <FiClock className="me-1" />
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    name="expiresAt"
                    className="form-control form-control-sm"
                    value={formData.expiresAt}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <small className="text-muted">
                    Leave empty for no expiration
                  </small>
                </div>
              )}
            </div>
          )}

          {!isAuthenticated && (
            <div className="mt-3">
              <small className="text-muted">
                <FiLink className="me-1" />
                Sign in to manage and track your links
              </small>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default UrlForm;
