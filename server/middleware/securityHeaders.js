/**
 * Security Headers Middleware
 * Implements CSP, HSTS, and other security best practices
 */

const securityHeaders = (req, res, next) => {
  // Content Security Policy - protects against XSS attacks
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.upstash.io; frame-src 'self' https://accounts.google.com"
  );
  
  // HSTS - enforces HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Referrer Policy - protect privacy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache policy for static assets and API
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    // Static assets: cache for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path.startsWith('/api/')) {
    // API responses: don't cache by default
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // HTML pages: cache for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
  
  next();
};

module.exports = securityHeaders;
