/**
 * URL List Component
 * Displays a list of URLs
 */

import React from 'react';
import { FiLink } from 'react-icons/fi';
import UrlCard from './UrlCard';
import { LoadingSpinner } from '../common';

const UrlList = ({ urls, isLoading, showActions = true, emptyMessage }) => {
  if (isLoading) {
    return <LoadingSpinner text="Loading your links..." />;
  }

  if (!urls || urls.length === 0) {
    return (
      <div className="text-center py-5">
        <FiLink size={48} className="text-muted mb-3" />
        <h5 className="text-muted">
          {emptyMessage || 'No links yet'}
        </h5>
        <p className="text-muted">
          Create your first short link above!
        </p>
      </div>
    );
  }

  return (
    <div className="url-list">
      {urls.map((url) => (
        <UrlCard key={url.id || url.shortCode} url={url} showActions={showActions} />
      ))}
    </div>
  );
};

export default UrlList;
