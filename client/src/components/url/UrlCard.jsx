/**
 * URL Card Component
 * Displays a single URL with actions
 */

import React, { useState } from 'react';
import {
  FiCopy,
  FiExternalLink,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiBarChart2,
  FiClock,
} from 'react-icons/fi';
import { useAuth, useUrls } from '../../context';
import { ConfirmModal } from '../common';

const UrlCard = ({ url, showActions = true }) => {
  const { isAuthenticated } = useAuth();
  const { deleteUrl } = useUrls();
  
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    originalUrl: url.originalUrl,
    expiresAt: url.expiresAt ? url.expiresAt.split('T')[0] : '',
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteUrl(url.shortCode);
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  const handleEdit = async () => {
    setIsSaving(true);
    try {
      const { urlService } = await import('../../services');
      await urlService.updateUrl(url.shortCode, {
        originalUrl: editData.originalUrl,
        expiresAt: editData.expiresAt || null,
      });
      // Reload page to show updated data
      window.location.reload();
    } catch (err) {
      console.error('Failed to update:', err);
      alert(err.response?.data?.error?.message || 'Failed to update URL');
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateUrl = (urlStr, maxLength = 50) => {
    if (urlStr.length <= maxLength) return urlStr;
    return urlStr.substring(0, maxLength) + '...';
  };
  
  const isExpired = url.expiresAt && new Date(url.expiresAt) < new Date();
  const isExpiringSoon = url.expiresAt && !isExpired && 
    (new Date(url.expiresAt) - new Date()) < 24 * 60 * 60 * 1000; // 24 hours

  return (
    <div className={`card mb-3 shadow-sm hover-shadow ${isExpired ? 'border-danger' : ''}`}>
      <div className="card-body">
        {isEditing ? (
          /* Edit Mode */
          <div className="p-2">
            <h6 className="text-muted mb-3">Edit URL</h6>
            <div className="mb-3">
              <label className="form-label small">Destination URL</label>
              <input
                type="url"
                className="form-control"
                value={editData.originalUrl}
                onChange={(e) => setEditData({ ...editData, originalUrl: e.target.value })}
                placeholder="https://example.com"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label small">Expiration Date (optional)</label>
              <input
                type="date"
                className="form-control"
                value={editData.expiresAt}
                onChange={(e) => setEditData({ ...editData, expiresAt: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
              <small className="text-muted">Leave empty for no expiration</small>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleEdit}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    originalUrl: url.originalUrl,
                    expiresAt: url.expiresAt ? url.expiresAt.split('T')[0] : '',
                  });
                }}
              >
                Cancel
              </button>
            </div>
            <div className="mt-2">
              <small className="text-muted">
                <strong>Short URL:</strong> {url.shortUrl} (cannot be changed)
              </small>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="row align-items-center">
            {/* Short URL */}
            <div className="col-md-4">
              <div className="d-flex align-items-center">
                <a
                  href={url.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`fw-medium text-decoration-none ${isExpired ? 'text-danger' : 'text-primary'}`}
                >
                  {url.shortUrl.replace(/^https?:\/\//, '')}
                </a>
                <button
                  className={`btn btn-sm ms-2 ${
                    copied ? 'btn-success' : 'btn-outline-secondary'
                  }`}
                  onClick={handleCopy}
                  title="Copy to clipboard"
                >
                  {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                </button>
              </div>
              {url.expiresAt && (
                <small className={`d-flex align-items-center mt-1 ${isExpired ? 'text-danger' : isExpiringSoon ? 'text-warning' : 'text-muted'}`}>
                  <FiClock size={12} className="me-1" />
                  {isExpired ? 'Expired' : `Expires ${formatDate(url.expiresAt)}`}
                </small>
              )}
            </div>

            {/* Original URL */}
            <div className="col-md-4">
              <a
                href={url.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted text-decoration-none d-flex align-items-center"
                title={url.originalUrl}
              >
                <FiExternalLink className="me-1 flex-shrink-0" size={14} />
                <span className="text-truncate">
                  {truncateUrl(url.originalUrl)}
                </span>
              </a>
            </div>

            {/* Stats */}
            <div className="col-md-2 text-center">
              <div className="d-flex align-items-center justify-content-center">
                <FiBarChart2 className="me-1 text-muted" />
                <span className="fw-medium">{url.clicks || 0}</span>
                <small className="text-muted ms-1">clicks</small>
              </div>
            </div>

            {/* Actions */}
            <div className="col-md-2 text-end">
              {showActions && isAuthenticated && (
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => setIsEditing(true)}
                    title="Edit"
                  >
                    <FiEdit2 size={14} />
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting}
                    title="Delete"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              )}
              {showActions && !isAuthenticated && (
                <div className="d-flex align-items-center justify-content-end">
                  <small className="text-muted me-2">
                    {formatDate(url.createdAt)}
                  </small>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting}
                    title="Delete"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Link"
        message={`Are you sure you want to delete this shortened URL? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default UrlCard;
