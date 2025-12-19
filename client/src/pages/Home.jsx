/**
 * Home Page Component
 * Landing page with URL shortener
 */

import React from 'react';
import { FiZap, FiLock, FiBarChart2, FiClock } from 'react-icons/fi';
import { UrlForm } from '../components/url';
import { useAuth } from '../context';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: FiZap,
      title: 'Lightning Fast',
      description: 'Create short links in seconds with our optimized infrastructure.',
    },
    {
      icon: FiLock,
      title: 'Secure & Reliable',
      description: 'Your links are safe with enterprise-grade security.',
    },
    {
      icon: FiBarChart2,
      title: 'Click Analytics',
      description: 'Track clicks and analyze your link performance.',
    },
    {
      icon: FiClock,
      title: 'Link Expiration',
      description: 'Set expiration dates for temporary campaigns.',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-primary text-white py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8 text-center">
              <h1 className="display-4 fw-bold mb-3">
                Shorten Your Links, Amplify Your Reach
              </h1>
              <p className="lead mb-4 opacity-75">
                Create short, memorable links in seconds. Track clicks, analyze
                performance, and grow your audience.
              </p>
            </div>
          </div>

          <div className="row justify-content-center">
            <div className="col-lg-8">
              <UrlForm />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-5">
        <div className="container">
          <div className="row text-center mb-5">
            <div className="col-12">
              <h2 className="fw-bold">Why Choose URLShortener?</h2>
              <p className="text-muted">
                Everything you need to manage your links effectively
              </p>
            </div>
          </div>

          <div className="row g-4">
            {features.map((feature, index) => (
              <div key={index} className="col-md-6 col-lg-3">
                <div className="card h-100 border-0 shadow-sm text-center p-4">
                  <div className="card-body">
                    <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex p-3 mb-3">
                      <feature.icon size={32} className="text-primary" />
                    </div>
                    <h5 className="card-title">{feature.title}</h5>
                    <p className="card-text text-muted">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-5 bg-dark text-white">
          <div className="container text-center">
            <h2 className="fw-bold mb-3">Ready to Get Started?</h2>
            <p className="lead mb-4 opacity-75">
              Create an account to unlock all features and manage your links.
            </p>
            <a href="/register" className="btn btn-primary btn-lg px-5">
              Create Free Account
            </a>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
