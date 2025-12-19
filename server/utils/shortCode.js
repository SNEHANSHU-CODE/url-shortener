/**
 * Short Code Generator
 * Generates collision-resistant short codes for URLs
 */

const crypto = require('crypto');
const config = require('../config');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a random short code
 * Uses crypto.randomBytes for better randomness
 */
const generateShortCode = (length = config.shortCode.length) => {
  const bytes = crypto.randomBytes(length);
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  
  return code;
};

/**
 * Generate a unique short code with collision detection
 * @param {Function} checkExists - Async function to check if code exists
 * @returns {Promise<string>} - Unique short code
 */
const generateUniqueShortCode = async (checkExists) => {
  const maxRetries = config.shortCode.maxRetries;
  
  for (let i = 0; i < maxRetries; i++) {
    const code = generateShortCode();
    const exists = await checkExists(code);
    
    if (!exists) {
      return code;
    }
    
    console.warn(`Short code collision detected: ${code}, retry ${i + 1}/${maxRetries}`);
  }
  
  // If all retries fail, generate a longer code
  return generateShortCode(config.shortCode.length + 2);
};

/**
 * Validate custom slug format
 * Only allows alphanumeric characters, hyphens, and underscores
 */
const isValidSlug = (slug) => {
  const slugRegex = /^[a-zA-Z0-9_-]+$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
};

/**
 * Generate a guest ID
 */
const generateGuestId = () => {
  return `guest_${crypto.randomBytes(16).toString('hex')}`;
};

module.exports = {
  generateShortCode,
  generateUniqueShortCode,
  isValidSlug,
  generateGuestId,
};
