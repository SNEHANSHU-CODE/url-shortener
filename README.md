# ⚡ URL Shortener — High-Performance URL Shortener

> A production-ready URL shortening service engineered for scalability, security, and sub-100ms redirection.

---

## 🚀 Key Technical Highlights

| Capability | Implementation |
|---|---|
| **Sub-100ms Latency** | caching via Redis hot-path store |
| **Enterprise Security** | JWT rotation, Google OAuth 2.0, Helmet-hardened HTTP headers |
| **Abuse Prevention** | Tiered rate limiting against DDoS and brute-force attacks |
| **Collision Resistance** | `crypto.randomBytes`-based short code generation with automatic retry |

---

## ✨ Features

### Backend & Infrastructure

- **Redis Integration** — High-speed caching for hot URL redirects and persistent session storage
- **Advanced Rate Limiting** — Tiered protection via `express-rate-limit` with separate windows for guests vs. authenticated users
- **Security Middleware** — Helmet-powered HTTP header hardening against XSS, clickjacking, and MIME sniffing
- **JWT Authentication** — Access/refresh token rotation for secure, stateless session management
- **Google OAuth 2.0** — First-class third-party sign-in for seamless user onboarding
- **Guest Mode & Migration** — Temporary guest URLs automatically migrate to a permanent account upon registration
- **Collision-Resistant Codes** — High-entropy short code generation with built-in retry logic to guarantee uniqueness

### Frontend

- **Modern Stack** — React 18 with Redux Toolkit for predictable, scalable state management
- **Responsive UI** — Mobile-first design using Bootstrap 5 utilities and custom CSS
- **Dynamic Dashboard** — Real-time link management with expiry tracking and click analytics

---

## 🗂️ Project Structure

```
url-shortener/
├── server/
│   ├── config/           # Database and Redis configurations
│   ├── controllers/      # Lean, single-responsibility request handlers
│   ├── middleware/       # Auth, error handling, Helmet, and rate-limiting layers
│   ├── models/           # Mongoose schemas — User, URL, Guest
│   ├── services/         # Core business logic — Auth, URL, Guest
│   ├── utils/            # Redis client, JWT helpers, short-code generator
│   └── server.js         # Optimized application entry point
├── client/               # React 18 / Redux Toolkit frontend
```

---

## 🏛️ Architecture Decisions

### 1. Distributed Caching with Redis
Moved from naïve in-memory objects to Redis, enabling horizontal scaling across multiple instances with consistent, low-latency redirection at each node.

### 2. Security-First HTTP Headers
Integrated Helmet to automatically apply industry-standard headers out of the box — drastically reducing the application's attack surface with zero manual configuration overhead.

### 3. Layered Defense Strategy
Combined CORS (origin allowlisting) with tiered rate limiting (traffic throttling) to ensure the API is only accessible from trusted clients while staying resilient against bot exhaustion and abuse.

### 4. Service Layer Pattern
Business logic is fully decoupled from controllers into a dedicated Services layer. This keeps request handlers lean, makes core logic independently testable, and ensures the codebase scales cleanly as features grow.

## 🌐 Live

| | |
|---|---|
| 🔗 App | [https://url-shortener-0f3m.onrender.com/](https://url-shortener-0f3m.onrender.com/) |
| 📧 Contact | snehanshusekhar99@gmail.com |
| 💼 LinkedIn | [Snehanshu Sekhar Jena](https://linkedin.com/in/snehanshu-sekhar-jena-5365841a1) |

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://linkedin.com/in/snehanshu-sekhar-jena-5365841a1">Snehanshu Sekhar Jena</a></sub>
</div>


Copyright (c) 2025 Your Name. All rights reserved.
This code may not be copied, modified, or distributed without explicit written permission.