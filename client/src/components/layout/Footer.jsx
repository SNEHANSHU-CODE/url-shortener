/**
 * Footer Component
 */

import React from 'react';
import { FiHeart, FiGithub } from 'react-icons/fi';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark text-light py-4 mt-auto">
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-6 text-center text-md-start">
            <p className="mb-0">
              © {currentYear} URLShortener. Made with{' '}
              <FiHeart className="text-danger mx-1" /> for simplicity.
            </p>
          </div>
          <div className="col-md-6 text-center text-md-end mt-2 mt-md-0">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-light text-decoration-none"
            >
              <FiGithub className="me-1" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
