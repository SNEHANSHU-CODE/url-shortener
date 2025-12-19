/**
 * Device Fingerprint Utility
 * Enterprise-standard guest identification using browser fingerprinting
 * Combined with localStorage/cookies for persistence
 */

// Generate a hash from string
const hashString = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Collect browser fingerprint components
const getFingerprint = async () => {
  const components = [];
  
  // Screen properties (use window.screen to avoid ESLint no-restricted-globals)
  const screenInfo = window.screen;
  components.push(`screen:${screenInfo.width}x${screenInfo.height}x${screenInfo.colorDepth}`);
  components.push(`screenAvail:${screenInfo.availWidth}x${screenInfo.availHeight}`);
  
  // Timezone
  components.push(`timezone:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  components.push(`timezoneOffset:${new Date().getTimezoneOffset()}`);
  
  // Language
  components.push(`language:${navigator.language}`);
  components.push(`languages:${navigator.languages?.join(',') || ''}`);
  
  // Platform
  components.push(`platform:${navigator.platform}`);
  components.push(`userAgent:${navigator.userAgent}`);
  
  // Hardware concurrency
  components.push(`cores:${navigator.hardwareConcurrency || 'unknown'}`);
  
  // Device memory (if available)
  components.push(`memory:${navigator.deviceMemory || 'unknown'}`);
  
  // Touch support
  components.push(`touch:${navigator.maxTouchPoints || 0}`);
  
  // WebGL renderer (more unique)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(`gpu:${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}`);
        components.push(`renderer:${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`);
      }
    }
  } catch (e) {
    components.push('gpu:unavailable');
  }
  
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('URLShortener-FP', 2, 2);
    components.push(`canvas:${canvas.toDataURL().slice(-50)}`);
  } catch (e) {
    components.push('canvas:unavailable');
  }
  
  // Audio context fingerprint
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    components.push(`audio:${audioContext.sampleRate}`);
    audioContext.close();
  } catch (e) {
    components.push('audio:unavailable');
  }
  
  // Combine and hash
  const fingerprint = components.join('|');
  const hash = await hashString(fingerprint);
  
  return hash.substring(0, 32); // Return first 32 chars for reasonable length
};

// Cookie utilities
const setCookie = (name, value, days = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

/**
 * Get or create a persistent guest identifier
 * Uses multiple storage mechanisms for resilience:
 * 1. localStorage (primary)
 * 2. Cookie (backup)
 * 3. Browser fingerprint (fallback for identification)
 */
export const getGuestIdentifier = async () => {
  const GUEST_ID_KEY = 'guestId';
  const FINGERPRINT_KEY = 'guestFingerprint';
  
  // Check localStorage first
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (guestId) {
    // Sync to cookie for backup
    setCookie(GUEST_ID_KEY, guestId);
    return guestId;
  }
  
  // Check cookie backup
  guestId = getCookie(GUEST_ID_KEY);
  if (guestId) {
    // Restore to localStorage
    localStorage.setItem(GUEST_ID_KEY, guestId);
    return guestId;
  }
  
  // Generate fingerprint for new guest
  const fingerprint = await getFingerprint();
  
  // Store fingerprint for reference
  localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  
  return null; // No existing guest ID, server will create one
};

/**
 * Store guest ID after server creates it
 */
export const storeGuestId = (guestId) => {
  localStorage.setItem('guestId', guestId);
  setCookie('guestId', guestId);
};

/**
 * Clear guest identification (on login/logout)
 */
export const clearGuestId = () => {
  localStorage.removeItem('guestId');
  localStorage.removeItem('guestFingerprint');
  setCookie('guestId', '', -1); // Expire cookie
};

/**
 * Get browser fingerprint for server-side matching
 */
export const getBrowserFingerprint = async () => {
  const stored = localStorage.getItem('guestFingerprint');
  if (stored) return stored;
  
  const fingerprint = await getFingerprint();
  localStorage.setItem('guestFingerprint', fingerprint);
  return fingerprint;
};

const guestFingerprint = {
  getGuestIdentifier,
  storeGuestId,
  clearGuestId,
  getBrowserFingerprint,
};

export default guestFingerprint;
