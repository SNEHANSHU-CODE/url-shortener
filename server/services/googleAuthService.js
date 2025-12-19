/**
 * Google OAuth Service
 * Handles Google authentication
 */

const { User, Url } = require('../models');
const { generateTokenPair } = require('../utils/jwt');
const { errors } = require('../utils/AppError');
const axios = require('axios');

class GoogleAuthService {
  /**
   * Verify Google access token and get user info
   */
  async verifyGoogleToken(accessToken) {
    try {
      // Use access token to get user info from Google
      const response = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      const { email, name, picture, id: googleId } = response.data;
      
      if (!email || !googleId) {
        throw errors.badRequest('Invalid Google token');
      }
      
      return { email, name, picture, googleId };
    } catch (error) {
      if (error.response) {
        throw errors.unauthorized('Invalid Google token');
      }
      throw error;
    }
  }
  
  /**
   * Authenticate with Google
   * - Links to existing account if email matches
   * - Creates new account otherwise
   * - Migrates guest URLs if guestId provided
   */
  async authenticateWithGoogle(accessToken, guestId = null) {
    const googleUser = await this.verifyGoogleToken(accessToken);
    
    let isNewUser = false;
    let migratedUrls = 0;
    
    // Check if user exists by Google ID
    let user = await User.findOne({ googleId: googleUser.googleId });
    
    if (!user) {
      // Check if user exists by email (link accounts)
      user = await User.findOne({ email: googleUser.email });
      
      if (user) {
        // Link Google account to existing user
        user.googleId = googleUser.googleId;
        if (!user.avatar && googleUser.picture) {
          user.avatar = googleUser.picture;
        }
        await user.save();
      } else {
        // Create new user
        user = new User({
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.googleId,
          avatar: googleUser.picture,
          isVerified: true, // Google emails are verified
        });
        await user.save();
        isNewUser = true;
      }
    }
    
    // Migrate guest URLs if guestId provided
    if (guestId) {
      const result = await Url.updateMany(
        { guestId, userId: null },
        { $set: { userId: user._id, guestId: null, expiresAt: null } }
      );
      migratedUrls = result.modifiedCount;
    }
    
    // Generate tokens
    const tokens = generateTokenPair(user._id);
    
    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();
    
    return { 
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser,
      migratedUrls,
    };
  }
}

module.exports = new GoogleAuthService();
