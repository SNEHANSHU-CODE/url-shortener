# URL Shortener

A production-ready URL shortening service with authentication, guest mode, analytics, and a modern React frontend.

## Features

### Backend
- **JWT Authentication** - Secure token-based auth with access/refresh token rotation
- **Google OAuth** - Sign in with Google integration
- **Guest Mode** - Create URLs without signing up, migrate them on registration
- **URL Shortening** - Collision-resistant short code generation
- **Custom Slugs** - Optional custom aliases for short URLs
- **Click Analytics** - Track clicks with timestamps
- **URL Expiration** - Optional expiration dates for temporary links
- **In-Memory Caching** - Hot URL caching for fast redirects (no Redis needed)
- **Rate Limiting** - Protection against abuse with different limits for guests/users
- **Centralized Error Handling** - Consistent error responses

### Frontend
- **React 18** with hooks
- **Redux Toolkit** for state management
- **React Router v6** for navigation
- **Bootstrap 5** for styling (utility classes, no React-Bootstrap)
- **React Icons** for iconography
- **Responsive Design** - Works on all devices

## Project Structure

```
url-shortener/
├── server/
│   ├── config/
│   │   ├── index.js          # Centralized configuration
│   │   └── database.js       # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js # Auth request handlers
│   │   └── urlController.js  # URL request handlers
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   ├── errorHandler.js   # Error handling
│   │   └── rateLimiter.js    # Rate limiting
│   ├── models/
│   │   ├── User.js           # User model
│   │   ├── Url.js            # URL model
│   │   └── Guest.js          # Guest session model
│   ├── routes/
│   │   ├── authRoutes.js     # Auth routes
│   │   ├── urlRoutes.js      # URL management routes
│   │   └── redirectRoutes.js # Redirect routes
│   ├── services/
│   │   ├── authService.js    # Auth business logic
│   │   ├── googleAuthService.js
│   │   ├── guestService.js   # Guest management
│   │   └── urlService.js     # URL business logic
│   ├── utils/
│   │   ├── AppError.js       # Custom error class
│   │   ├── cache.js          # In-memory cache
│   │   ├── jwt.js            # Token utilities
│   │   └── shortCode.js      # Short code generation
│   └── server.js             # Entry point
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/       # Reusable components
│   │   │   ├── layout/       # Navbar, Footer
│   │   │   └── url/          # URL-related components
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── NotFound.jsx
│   │   ├── services/         # API services
│   │   ├── store/            # Redux store
│   │   │   └── slices/       # Redux slices
│   │   └── App.js
│   └── package.json
│
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables:
   ```env
   PORT=8080
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/url-shortener
   JWT_ACCESS_SECRET=your-access-secret
   JWT_REFRESH_SECRET=your-refresh-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   CORS_ORIGINS=http://localhost:3000
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The app will be available at `http://localhost:3000`.

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/guest` | Initialize guest session |

### URLs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/urls` | Create short URL |
| GET | `/api/urls/my-urls` | Get user's URLs |
| GET | `/api/urls/guest-urls` | Get guest's URLs |
| GET | `/api/urls/:shortCode/info` | Get URL info |
| GET | `/api/urls/:shortCode/stats` | Get URL statistics |
| PATCH | `/api/urls/:shortCode` | Update URL |
| DELETE | `/api/urls/:shortCode` | Delete URL |

### Redirects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:shortCode` | Redirect to original URL |

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Auth endpoints | 10 requests / 15 min |
| URL creation (authenticated) | 30 requests / min |
| URL creation (guest) | 10 requests / min |

## Architecture Decisions

1. **In-Memory Cache**: Uses a custom TTL cache instead of Redis for simplicity. Hot URLs are cached for 1 hour with automatic cleanup.

2. **Token Rotation**: Refresh tokens are rotated on each use, improving security against token theft.

3. **Guest Migration**: URLs created by guests are seamlessly migrated to their account upon registration/login.

4. **Collision-Resistant Codes**: Uses crypto.randomBytes for generating short codes with collision detection and retry logic.

5. **No Business Logic in Routes**: All business logic is in the services layer, keeping controllers thin.

## License

MIT
