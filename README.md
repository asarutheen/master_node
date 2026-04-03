# 🔐 Login Service - Advanced Security Implementation

**Phase 2: Advanced Security Implementation** ✅

This is a production-grade authentication service with account lockout, rate limiting, 2FA (TOTP), JWT tokens, token blacklisting, and comprehensive audit logging.

---

## 📋 Project Structure

```
login-service/
├── server.js                          # Entry point - starts server
├── package.json
├── .env                               # Configuration (create this)
│
└── src/
    ├── app.js                         # Express app setup + middleware
    │
    ├── config/
    │   ├── env.js                     # ENV validation (fail-fast principle)
    │   └── db.js                      # PostgreSQL connection + pooling
    │
    ├── data/
    │   └── table.sql                  # Database schema (create tables)
    │
    ├── modules/auth/
    │   ├── auth.routes.js             # POST /auth/* endpoints
    │   ├── auth.controller.js         # HTTP layer (extract req, send res)
    │   ├── auth.service.js            # Business logic (login, 2FA, tokens)
    │   └── auth.repository.js         # Database queries (SELECT, INSERT, UPDATE)
    │
    └── shared/
        ├── middleware/
        │   ├── authorize.js           # JWT verification middleware
        │   ├── rateLimiter.js         # IP-based rate limiting (10 attempts/15 min)
        │   └── verifyToken.js         # Token blacklist check
        │
        └── utils/
            ├── asyncHandler.js        # Express error handler wrapper
            ├── auditLog.js            # Security event logging
            └── tokenStore.js          # Token blacklist (in-memory)
```

---

## 🎯 Phase 2 Features

### ✅ Account Lockout System

- **5 failed login attempts** → account locked for **15 minutes**
- Tracks failed attempts **per email address**
- Resets counter on successful login
- Database-persisted (survives server restart)

### ✅ IP-Based Rate Limiting

- **10 login attempts per IP** → blocked for **15 minutes**
- Blocks requests **before** reaching login logic
- Protects against distributed brute force attacks
- In-memory (resets on server restart)

### ✅ Two-Factor Authentication (2FA)

- TOTP-based (Time-based One-Time Password)
- **6-digit codes** generated using shared secret
- Codes valid for **30 seconds**
- Setup and verification endpoints
- Optional per user

### ✅ JWT Token Management

- **Access tokens**: 1 hour expiry
- **Refresh tokens**: 7 days expiry
- Token blacklisting on logout
- Automatic cleanup of expired tokens

### ✅ Comprehensive Audit Logging

- Records: login attempts, lockouts, 2FA events, token refresh, logout
- Tracks: IP address, user agent, timestamp, event details
- Separate from application logic (non-blocking)

---

## 🚀 Getting Started

### 1. Setup Environment

Create `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_REFRESH_SECRET=your_refresh_secret_key_change_this_too
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=login_service
DB_USER=postgres
DB_PASSWORD=your_password

# 2FA
TOTP_WINDOW=1
```

### 2. Create Database

Connect to PostgreSQL and run:

```sql
-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create login attempts table
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  failed_attempts INT DEFAULT 1,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit logs table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Server

```bash
npm start
```

Expected output:

```
[SERVER] Running on http://localhost:3000
[SERVER] Environment: development
```

---

## 👥 Test Users

Pre-create these users in the database for testing:

| Email             | Password | 2FA         | Role  | Purpose          |
| ----------------- | -------- | ----------- | ----- | ---------------- |
| alice@example.com | alice123 | ✅ Enabled  | user  | Test 2FA flow    |
| bob@example.com   | bob123   | ❌ Disabled | user  | Test basic login |
| admin@example.com | admin123 | ✅ Enabled  | admin | Test role access |

Insert into database:

```sql
INSERT INTO users (email, password_hash, role, two_factor_enabled, two_factor_secret) VALUES
('alice@example.com', '$2b$10$...hash...', 'user', true, 'LMYTKMZFLUZU4LCYOZFCYMS2OI6E2ZDFKQQS4MLBFZFHKOSWJAZA'),
('bob@example.com', '$2b$10$...hash...', 'user', false, NULL),
('admin@example.com', '$2b$10$...hash...', 'admin', true, 'LMYTKMZFLUZU4LCYOZFCYMS2OI6E2ZDFKQQS4MLBFZFHKOSWJAZA');
```

---

## 🧪 API Testing Guide

### 1️⃣ Step 1: Login (Email + Password)

#### ✅ Success Case

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "bob123"
  }'
```

**Response** (200 OK):

```json
{
  "success": true,
  "status": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "requiresTwoFactor": false,
    "stepToken": null
  }
}
```

#### ❌ Error: Wrong Password

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "wrongpass"
  }'
```

**Response** (401 Unauthorized):

```json
{
  "success": false,
  "status": 401,
  "message": "Invalid credentials"
}
```

#### ❌ Error: Account Locked

```bash
# After 5 failed attempts...
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "wrongpass"
  }'
```

**Response** (429 Locked):

```json
{
  "success": false,
  "status": 429,
  "message": "Account locked. Try again in 15 minutes"
}
```

#### ❌ Error: Rate Limit (10 requests per 15 min per IP)

```bash
# Make 11 requests quickly from same IP...
```

**Response** (429 Too Many Requests):

```
Too many login requests from this IP, please try again after 15 minutes
```

#### ✅ 2FA Required Case

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "alice123"
  }'
```

**Response** (200 - requires 2FA):

```json
{
  "success": true,
  "status": 200,
  "message": "Two-factor authentication required",
  "data": {
    "accessToken": null,
    "refreshToken": null,
    "requiresTwoFactor": true,
    "stepToken": "temp_token_for_otp_verification"
  }
}
```

---

### 2️⃣ Step 2: Verify OTP (if 2FA enabled)

First, generate OTP code:

```bash
node -e "const s = require('speakeasy'); console.log(s.totp({ secret: 'LMYTKMZFLUZU4LCYOZFCYMS2OI6E2ZDFKQQS4MLBFZFHKOSWJAZA', encoding: 'base32' }));"
```

Then verify (copy-paste code **immediately**):

```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "stepToken": "temp_token_from_step1",
    "otp": "123456"
  }'
```

#### ✅ Success Case (200 OK)

```json
{
  "success": true,
  "status": 200,
  "message": "OTP verified successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### ❌ Error: Invalid OTP (401)

```json
{
  "success": false,
  "status": 401,
  "message": "Invalid OTP code"
}
```

#### ❌ Error: OTP Timing Issue

**Reason**: Time window shifted between generation and verification
**Solution**: Generate code immediately before sending request or use authenticator app

---

### 3️⃣ Step 3: Refresh Token

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

#### ✅ Success (200 OK)

```json
{
  "success": true,
  "status": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 4️⃣ Logout (Blacklist Token)

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{}'
```

#### ✅ Success (200 OK)

```json
{
  "success": true,
  "status": 200,
  "message": "Logged out successfully"
}
```

---

### 5️⃣ Setup 2FA

```bash
# Step A: Get TOTP secret
curl -X POST http://localhost:3000/auth/2fa/setup \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response**:

```json
{
  "success": true,
  "status": 200,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ2HY2LOM4======",
    "qrCode": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

```bash
# Step B: Verify and enable 2FA
curl -X POST http://localhost:3000/auth/2fa/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "JBSWY3DPEBLW64TMMQ2HY2LOM4======",
    "otp": "123456"
  }'
```

**Response** (200 OK):

```json
{
  "success": true,
  "status": 200,
  "message": "2FA enabled successfully"
}
```

---

## 🔍 How It Works

### Login Flow (2-Step Process)

```
User provides email + password
              ↓
        Rate Limiter Check
    (10 attempts per 15 mins per IP)
              ↓
        Account Lockout Check
    (locked after 5 failed attempts)
              ↓
        Password Verification
              ↓
    2FA Enabled? ──→ YES → Return stepToken → User enters OTP
              ↓
              NO
              ↓
    Return Access + Refresh Tokens
```

### Rate Limiter vs Account Lockout

| Feature           | Rate Limiter                   | Account Lockout                |
| ----------------- | ------------------------------ | ------------------------------ |
| **Protects**      | IP Address                     | User Email                     |
| **Triggered by**  | Any request from IP            | 5 failed password attempts     |
| **Lock Duration** | 15 minutes (automatic)         | 15 minutes (automatic)         |
| **Storage**       | In-memory (resets on restart)  | Database (persists)            |
| **Use Case**      | Stops bots/distributed attacks | Stops targeted account attacks |

**Why both?**

- Rate limiter: Stops someone attacking from a single IP (fast, early defense)
- Account lockout: Stops someone attacking a specific account (thorough defense)

---

### JWT Token Flow

```
Login Success
    ↓
Generate 2 tokens:
├─ Access Token (1 hour) → use for API requests
└─ Refresh Token (7 days) → use to get new access token

User makes request to /api/profile
    ↓
Authorization: Bearer <access-token>
    ↓
Token Verification:
├─ Is token in blacklist? → YES → 401 Unauthorized
├─ Is token expired? → YES → 401 Unauthorized (send refresh request)
└─ Is token valid? → YES → Process request

After 1 hour:
    ↓
Access token expires automatically
    ↓
Client sends refresh request with refresh token
    ↓
Generate new access token (valid for 1 more hour)
    ↓
Refresh token still has 6 days left
```

### 2FA (TOTP) Flow

```
2FA Setup:
├─ Generate random secret
├─ User scans QR code with Authenticator app
└─ User verifies by entering 6-digit code

2FA Login:
├─ Email + Password verified
├─ 2FA check: enabled? → YES
├─ Return stepToken (temporary, 10 min expiry)
└─ User enters code from Authenticator app

Verify OTP:
├─ Is stepToken valid? → Check expiry + signature
├─ Is OTP code correct? → Verify against secret
└─ Issue access + refresh tokens
```

**Why TOTP (not SMS)?**

- SMS can be intercepted
- TOTP is offline (can't intercept airwaves)
- Works on authenticator apps (Google Auth, Authy, Microsoft Auth)

### Audit Logging Flow

```
User logs in
    ↓
Process request (verify password, check lockout, etc)
    ↓
Non-blocking: Write audit log async
    ├─ Log success/failure
    ├─ Record IP + user agent
    ├─ Save event details
    └─ If write fails → log error, continue anyway

Why non-blocking?
├─ Logging failure shouldn't crash login
├─ Audit logging is important but not critical
└─ Critical path: password verification (blocks on failure)
```

**Logged Events:**

- `LOGIN_SUCCESS` - Successful login
- `LOGIN_FAILED` - Wrong password / user not found
- `LOGIN_LOCKED` - Account locked (5 failed attempts)
- `LOGOUT` - User logout
- `TOKEN_REFRESH` - Refresh token used
- `OTP_VERIFIED` - 2FA code verified

---

## 🛡️ Security Checklist

- ✅ **Passwords hashed** with bcrypt (salted, irreversible)
- ✅ **Secrets in environment** (never in code)
- ✅ **Rate limiting** (10/15min per IP on login)
- ✅ **Account lockout** (15 min after 5 failures)
- ✅ **2FA support** (TOTP-based, time-based)
- ✅ **Token expiry** (access: 1hr, refresh: 7 days)
- ✅ **Token blacklisting** (logout invalidates tokens)
- ✅ **Audit logging** (all auth events tracked)
- ✅ **Connection pooling** (prevents DB connection overflow)
- ✅ **Error handling** (doesn't leak sensitive info)
- ✅ **Fail-fast startup** (env validation before server starts)

---

## ❓ FAQ

### Q: My OTP always shows "Invalid"

**A:** TOTP codes are time-based and valid for only 30 seconds.

- **Issue**: Time delay between generating code and sending request
- **Solution**: Generate code immediately before request or use an authenticator app
- **Debug**: Check system clock on both client and server are synced

### Q: How does rate limiting work?

**A:** Express-rate-limit tracks requests per IP address in memory:

- Stores: `ip_address → array of request timestamps`
- Cleans up: Old timestamps automatically removed
- **No database** needed (fast, in-memory)
- **Resets** on server restart

### Q: Why does account lockout use database but rate limiting uses memory?

**A:** Different protection levels:

- **Rate limiting** (memory): Fast, prevents obvious attacks before expensive DB queries
- **Account lockout** (database): Persists across server restarts, protects specific users
- **Together**: Layered defense against both distributed attacks and targeted attacks

### Q: Can I disable rate limiting?

**A:** Yes, but not recommended. To test without limits:

```javascript
// In auth.routes.js - comment out rate limiter
// app.use("/auth/login", loginRateLimiter);
router.post("/login", handleLoginStep1);
```

### Q: Why use JWT instead of sessions?

**A:** Stateless authentication:

- **JWT**: No server-side session storage (scales horizontally)
- **Sessions**: Server stores session data (requires sticky sessions or session storage)
- **Tradeoff**: JWT can't be instantly revoked (unless blacklisted on logout)

### Q: What happens if JWT_SECRET changes?

**A:** All existing tokens become invalid. Users must log in again.

### Q: Can I add email verification?

**A:** Yes, add step between registration and login:

```javascript
// User registers
// Email sent with verification link
// User clicks link
// Email verified → can now login
// Add: email_verified BOOLEAN to users table
```

### Q: What about password reset?

**A:** Add these endpoints:

```javascript
POST /auth/forgot-password  → send reset email
POST /auth/reset-password   → verify token + set new password
```

### Q: How do I test locally without real email?

**A:** Use Ethereal Email (fake SMTP):

```bash
npm install nodemailer
```

Then configure in env:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=fake@ethereal.email
SMTP_PASS=password
```

---

## 🚀 Next Steps (Phase 3)

- **Database persistence** of audit logs
- **Email notifications** (login alerts, 2FA codes)
- **Password reset** flow
- **Email verification** for new accounts
- **Admin dashboard** to view audit logs
- **Metrics & monitoring** (failed logins per user, suspicious patterns)

---

## 📚 Concepts Explained

### Fail-Fast Principle

Start the server only when **all dependencies are healthy**. Don't start if:

- Environment variables missing
- Database unreachable
- Configuration invalid

**Why?** If the server starts but JWT_SECRET is missing, the first login crashes at 2am in production. With fail-fast, DevOps catches it at deployment time, before any user is affected.

### Connection Pooling

Share a limited number of database connections across all requests:

Without pooling:

```
1000 requests = 1000 database connections
PostgreSQL max is 100 → CRASH
```

With pooling:

```
10 connections shared for 1000 requests
Requests queue and reuse connections
PostgreSQL stays healthy
```

### Single Responsibility Principle

Each layer has **one reason to change**:

- `routes.js` → changes when URL structure changes
- `controller.js` → changes when response format changes
- `service.js` → changes when business logic changes
- `repository.js` → changes when database schema changes

This keeps code maintainable as team grows.

### Non-Critical Path

Audit logging **doesn't block** login:

```
Login succeeds
    ↓
Log audit event (async, non-blocking)
    ↓
If logging fails → just log error to console
    ↓
User still gets tokens

vs wrong approach:

Login fails
    ↓
Crash because logging failed
    ↓
User can't log in
```

---

## 🔧 Troubleshooting

| Issue                                            | Cause                  | Solution                               |
| ------------------------------------------------ | ---------------------- | -------------------------------------- |
| `Error: Cannot find module '../data/auditLog'`   | auditLog.js missing    | Create the file in `src/shared/utils/` |
| `Error: connect ECONNREFUSED 127.0.0.1:5432`     | PostgreSQL not running | Start PostgreSQL service               |
| `FATAL: database "login_service" does not exist` | DB not created         | Run `CREATE DATABASE login_service;`   |
| `OTP always invalid`                             | Time sync issue        | Check system clock sync                |
| `Error: JWT_SECRET is not defined`               | Env variable missing   | Add to .env file                       |
| `429 Too Many Requests`                          | Rate limited           | Wait 15 minutes or change IP           |

---

**Last Updated**: April 2026 | **Version**: 2.0 (Phase 2 Complete)

[ENV] All environment variables loaded successfully.
[DB] PostgreSQL connected successfully.
[SERVER] Running on http://localhost:3000
[SERVER] Environment: development

Phase 6 restructuring is complete. Here's what we now have vs where we started:
Phase 1-5 (old) Phase 6 (now)
──────────────── ─────────────
routes/auth.js modules/auth/auth.routes.js
modules/auth/auth.controller.js
modules/auth/auth.service.js
modules/auth/auth.repository.js

middleware/auth.js shared/middleware/verifyToken.js
middleware/authorize.js shared/middleware/authorize.js
middleware/rateLimiter.js shared/middleware/rateLimiter.js

data/users.js PostgreSQL users table
data/tokenStore.js shared/utils/tokenStore.js
data/auditLog.js shared/utils/auditLog.js
data/loginAttempts.js PostgreSQL login_attempts table

server.js (did everything) server.js → starts server
src/app.js → express setup
src/config/env.js → validates env
src/config/db.js → DB connection
