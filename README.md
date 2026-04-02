# 🔐 Login Service with Security Features

## ✅ Phase 2: Advanced Security Implementation

A production-ready Node.js authentication service with enterprise-grade security features including role-based access control, comprehensive audit logging, and two-factor authentication.

---

## 🏗️ Project Structure

```
login-service/
├── server.js           # Main Express server with middleware setup
├── generateHash.js     # Password hashing utility
├── package.json        # Dependencies and scripts
├── data/
│   ├── users.js        # User data with roles and 2FA secrets
│   ├── loginAttempts.js # Account lockout tracking
│   ├── tokenStore.js   # JWT token blacklisting
│   └── auditLog.js     # Security event logging
├── middleware/
│   ├── auth.js         # JWT verification middleware
│   ├── authorize.js    # Role-based access control
│   └── rateLimiter.js  # IP-based rate limiting
└── routes/
    └── auth.js         # Authentication endpoints
```

---

## 👥 Test Users

| Email               | Password   | Role  | 2FA Status  |
| ------------------- | ---------- | ----- | ----------- |
| `alice@example.com` | `alice123` | admin | ✅ Enabled  |
| `bob@example.com`   | `bob456`   | user  | ❌ Disabled |

---

## 🔑 Beginner-Friendly Concepts

### JWT Authentication Flow

```
1. User logs in with email + password (+ 2FA if enabled)
2. Server validates credentials
3. Server issues JWT access token (short-lived, 15min)
4. Client stores token in localStorage/sessionStorage
5. Client sends token in Authorization header for protected routes
6. Server verifies token on each request
7. When token expires, use refresh token to get new access token
```

### Role-Based Access Control (RBAC)

```
User Role: Can access basic profile and dashboard
Admin Role: Can access everything + admin panel + audit logs
```

---

## 🚀 Quick Start & Testing

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Server

```bash
npm start
# Server runs on http://localhost:3000
```

### 3. Test Login (No 2FA - Bob)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"bob456"}'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 4. Test Protected Route

```bash
curl http://localhost:3000/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🧪 Practical Examples + Error Cases

### ✅ Successful Admin Login with 2FA

**Request:**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "alice123",
    "otp": "123456"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "...",
  "refreshToken": "..."
}
```

### ❌ Wrong Password Error

**Request:**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"wrongpass"}'
```

**Response:**

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### ❌ Account Locked (After 5 Failed Attempts)

**Response:**

```json
{
  "success": false,
  "message": "Account locked due to too many failed attempts. Try again in 15 minutes."
}
```

### ❌ Rate Limited (Too Many Requests from Same IP)

**Response:**

```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

### ❌ Invalid OTP Code

**Response:**

```json
{
  "success": false,
  "message": "Invalid OTP code"
}
```

### ❌ Unauthorized Access (User Trying Admin Route)

**Request:**

```bash
curl http://localhost:3000/admin \
  -H "Authorization: Bearer USER_TOKEN"
```

**Response:**

```json
{
  "success": false,
  "message": "Forbidden: Insufficient permissions"
}
```

---

## 🔍 How It Works

### Rate Limiting vs Account Lockout

**IP-Based Rate Limiting** (`middleware/rateLimiter.js`):

- Protects against brute force attacks from same IP
- Limits to 10 login attempts per 15-minute window
- Uses `express-rate-limit` library
- No persistent storage (resets on server restart)
- **First line of defense** - blocks before expensive operations

**Account Lockout** (`data/loginAttempts.js`):

- Protects individual user accounts
- Locks account for 15 minutes after 5 failed attempts
- Stores attempts in memory Map
- **Second line of defense** - prevents account takeover

### Route Execution Order for `/auth/login`

```
Request → Rate Limiter → Auth Routes → Login Handler
         ↓              ↓              ↓
     429 Blocked    429 Blocked   Account Logic
     or Continue    or Continue    (validation, 2FA, tokens)
```

Both middlewares execute because `/auth/login` matches both:

- `app.use("/auth/login", loginRateLimiter)`
- `app.use("/auth", authRoutes(findUserByEmail))`

### JWT Token Flow

**Access Token** (15 minutes):

- Used for API calls
- Contains user info + role
- Verified on every protected request

**Refresh Token** (7 days):

- Used to get new access tokens
- Stored securely (not in localStorage)
- Can be revoked (logout blacklists it)

### 2FA TOTP Implementation

**Setup Phase:**

```javascript
// Generate secret
const secret = speakeasy.generateSecret({ name: "Login Service" });

// Save to user.twoFactorSecret
user.twoFactorSecret = secret.base32;
```

**Login Phase:**

```javascript
// Verify OTP
const isValid = speakeasy.totp.verify({
  secret: user.twoFactorSecret,
  encoding: "base32",
  token: req.body.otp,
  window: 1, // ±30 seconds tolerance
});
```

---

## 📋 Postman Collection Setup

### Import Collection

1. Open Postman
2. Import `login-service.postman_collection.json`
3. Set environment variables:
   - `base_url`: `http://localhost:3000`
   - `access_token`: (will be set after login)

### Test Scenarios

1. **Login Tests** - Try different users and error cases
2. **Protected Routes** - Test with/without tokens
3. **Role Testing** - Admin vs user access
4. **2FA Flow** - Generate OTP codes for testing

---

## 🔒 Security Checklist

### ✅ Implemented Features

- [x] Password hashing with bcrypt
- [x] JWT access + refresh tokens
- [x] IP-based rate limiting (10/15min)
- [x] Account lockout (5 attempts = 15min lock)
- [x] Role-based access control (admin/user)
- [x] Two-factor authentication (TOTP)
- [x] Comprehensive audit logging
- [x] Token blacklisting on logout
- [x] Input validation and sanitization
- [x] CORS protection
- [x] Helmet security headers

### 🔄 Ready for Production

- [x] Environment variables for secrets
- [x] Proper error handling (no sensitive data leaks)
- [x] Structured logging for monitoring
- [x] Database-ready architecture (Phase 6)
- [x] Scalable middleware design

---

## ❓ FAQ

### Q: Why does my OTP code always fail?

**A:** TOTP codes are time-based and expire every 30 seconds. The delay between generating the code and sending the request can cause it to expire. Use an authenticator app instead of manual generation for testing.

### Q: What's the difference between rate limiting and account lockout?

**A:** Rate limiting protects against IP-level attacks (distributed bots), while account lockout protects individual user accounts from targeted attacks. Both work together for layered security.

### Q: How do I test 2FA without an authenticator app?

**A:** Use the terminal command to generate codes:

```bash
node -e "const s = require('speakeasy'); console.log(s.totp({ secret: 'YOUR_SECRET', encoding: 'base32' }));"
```

### Q: Why do both middlewares execute for `/auth/login`?

**A:** Express matches routes in registration order. `/auth/login` matches both the specific rate limiter middleware and the general `/auth` router, so both execute sequentially.

### Q: How do refresh tokens work?

**A:** Access tokens are short-lived (15min) for security. When they expire, send the refresh token to `/auth/refresh` to get a new access token without re-entering credentials.

### Q: What gets logged in audit logs?

**A:** All authentication events: successful/failed logins, account lockouts, token refreshes, logouts, and IP addresses for security monitoring.

---

## 🎯 Next Steps

**Phase 3:** Database Integration (PostgreSQL)  
**Phase 4:** Email Notifications  
**Phase 5:** Password Reset Flow  
**Phase 6:** Production Deployment

## 2FA Setup Flow

```
SETUP (once)                         LOGIN (every time)
────────────────                     ──────────────────
POST /auth/2fa/setup                 POST /auth/login
       ↓                                    ↓
speakeasy generates secret           user opens Google Authenticator
       ↓                                    ↓
save secret in users.js/DB           app shows 6 digit code
       ↓                                    ↓
show QR code to user once            user types code into login form
       ↓                                    ↓
user scans with Authenticator app    server runs speakeasy.totp.verify()
       ↓                                    ↓
app stores secret permanently        code matches → issue tokens
       ↓                                    ↓
never show secret again              code expires in 30 seconds
                                            ↓
                                     next login → new 6 digit code
```

**Key Points:**

- Secret created once, stored permanently
- OTP codes are one-time use, expire every 30 seconds
- Uses industry-standard TOTP (Time-based One-Time Password)
