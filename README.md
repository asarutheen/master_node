# login-service

Node.js authentication service with JWT tokens (Phase 1 → 2)

---

## 🚀 Quick Start

1. Open terminal in the `login-service` folder
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Server listens on `http://localhost:3000`

---

## 📋 Phase 1: Basic Login (Complete ✅)

### 🔐 Login endpoint

POST `http://localhost:3000/auth/login`

Request:

```json
{
  "email": "alice@example.com",
  "password": "alice123"
}
```

Response (Phase 1):

```json
{
  "success": true,
  "message": "Login successful.",
  "user": {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

Response (Phase 2 — with JWT token):

```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔑 Phase 2: JWT Token Auth (Complete ✅)

### What changed

- Login now returns a **JWT token** instead of user data
- Every protected route requires token in `Authorization` header
- Token expires in 15 minutes (configurable)

### Environment setup

All secrets stored in `.env` (never commit this):

```bash
PORT=3000
JWT_SECRET=my_super_secret_key_change_this_in_production
JWT_EXPIRES_IN=15m
```

> **Why separate secrets?** Real apps store `.env` in a secure vault. This file uses `dotenv` to load variables at startup—once, not every request. `JWT_SECRET` is never exposed to the client.

### Protected routes

#### GET `/profile` (protected)

Get your profile using token:

```bash
Authorization: Bearer <your_token_from_login>
```

Response:

```json
{
  "success": true,
  "message": "This is your profile.",
  "user": {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com",
    "iat": 1704067200,
    "exp": 1704068100
  }
}
```

#### GET `/dashboard` (protected)

Same auth pattern:

```bash
Authorization: Bearer <your_token>
```

Response:

```json
{
  "success": true,
  "message": "Welcome to the dashboard.",
  "user": { ... }
}
```

### Error cases

**Missing token:**

```bash
GET http://localhost:3000/profile
(no Authorization header)
```

Response:

```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

**Expired token:**

```json
{
  "success": false,
  "message": "Token expired. Please log in again."
}
```

**Invalid/malformed token:**

```json
{
  "success": false,
  "message": "Invalid token."
}
```

---

## 🛠️ How it works behind the scenes

### Login flow (Phase 2)

1. User sends email + password
2. Server validates password with `bcrypt.compare()`
3. Server signs JWT payload with `jwt.sign()` using `JWT_SECRET`
4. Token returned to client
5. Client stores token (localStorage, sessionStorage, or cookie)

### Protected route flow

1. Client sends request with `Authorization: Bearer <token>` header
2. Middleware `verifyToken` extracts token from header
3. `jwt.verify()` checks signature matches `JWT_SECRET`
4. If valid → decoded payload (id, name, email, exp) attached to `req.user`
5. If invalid/expired → 401 response, handler never runs

---

## 🧪 Test users

From `data/users.js`:

- alice: `alice@example.com` / `alice123`
- bob: `bob@example.com` / `bob456`

---

## 📁 Project structure

```
server.js                    — Express app, routes, protected endpoints
routes/auth.js               — Login logic, bcrypt verify, JWT sign
middleware/auth.js           — verifyToken middleware for protected routes
data/users.js                — User table with bcrypt hashes
.env                         — Secrets (JWT_SECRET, expires time)
.gitignore                   — Never commit .env or node_modules
generateHash.js              — One-time helper to generate password hashes
```

---

## 🧠 Key concepts for beginners

### Why JWT?

- **Stateless** — no session database needed
- **Portable** — token travels with each request
- **Secure** — signature prevents tampering
- **Expiring** — short-lived tokens limit damage if stolen

### Why middleware?

Express middleware is a chainable filter:

```javascript
app.get("/profile", verifyToken, handler);
```

Order matters:

1. Request comes in
2. `verifyToken` runs first (checks token)
3. If it calls `next()` → `handler` runs
4. If it returns 401 → `handler` never runs

### Why `.env`?

Never hardcode secrets. Use environment variables:

```javascript
// ❌ Bad
const secret = "my_super_secret_key";

// ✅ Good
const secret = process.env.JWT_SECRET; // from .env
```

Production apps store this in a vault (AWS Secrets Manager, HashiCorp Vault, etc.).

---

## 🚦 Testing with Postman / Curl

### Step 1: Login and get token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}'
```

Copy the `token` from response.

### Step 2: Use token on protected route

```bash
curl http://localhost:3000/profile \
  -H "Authorization: Bearer <paste_token_here>"
```

### Step 3: Verify token blocks missing auth

```bash
curl http://localhost:3000/profile
# Should get "Access denied. No token provided."
```

---

## 🔄 What's next (Phase 3)

- PostgreSQL database (replace `data/users.js`)
- Refresh tokens (auto-refresh expired access tokens)
- Registration endpoint (hash + store password)
- Rate limiting on login (prevent brute force)

---

## 📝 Security checklist

- ✅ Passwords hashed with bcrypt
- ✅ Tokens expire quickly (15m)
- ✅ JWT secret kept in `.env` (not in code)
- ✅ `.env` added to `.gitignore`
- ✅ Middleware protects sensitive routes
- ✅ Never return password hash to client

---

## 🤔 Common questions

**Q: Why not put the secret in the code?**  
A: If code leaks (e.g., GitHub), attackers forge tokens. `.env` is environment-specific and stays local/in vault.

**Q: Can I use 24-hour tokens instead of 15 min?**  
A: Yes—change `JWT_EXPIRES_IN=24h` in `.env`. Shorter is safer (Phase 3 adds refresh tokens).

**Q: What if I need to logout?**  
A: JWT doesn't need logout (tokens are stateless). Client just deletes token. Add a token blacklist if you want immediate logout.

**Q: How do I rotate the JWT_SECRET?**  
A: Generate new secret, update `.env`, restart server. Old tokens become invalid—users re-login.
