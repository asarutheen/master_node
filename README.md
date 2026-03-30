# login-service

Simple Node.js login service (Phase 1)

## 🚀 Quick start

1. Open terminal in the `login-service` folder
2. Install dependencies:
   - `npm install`
3. Start development server:
   - `npm run dev`
4. Server listens on `http://localhost:3000`

## 🔍 Health check

- GET `http://localhost:3000/health`

Expected response:

```
{ "status": "ok" }
```

## 🔐 Login endpoint

POST `http://localhost:3000/auth/login`

Request body (JSON):

```json
{
  "email": "alice@example.com",
  "password": "alice123"
}
```

Response on success:

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

Response on invalid credentials:

```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

## 🗂️ Project structure

- `server.js` - app setup, JSON middleware, routes
- `routes/auth.js` - login route and bcrypt password compare
- `data/users.js` - in-memory user table with hashed passwords
- `generateHash.js` - helper script to create bcrypt hashes manually

## 🔁 Why `generateHash.js` + `data/users.js` separate

- `generateHash.js` is a one-time helper. Run when you need a new hash for a password.
- `data/users.js` stores pre-hashed passwords (simulating database stored hashes).
- This avoids:
  - re-hashing on every server startup
  - top-level `await` issues in CommonJS module format

### Example usage (one-time)

1. In `generateHash.js`, change password values if needed:
   - `alice123`, `bob456`
2. Run:
   - `node generateHash.js`
3. Copy the printed hashes to `data/users.js` user records

> Real app pattern: we will do the hashing at registration, store hash permanently, compare on login.

## 🧪 Test users (from `data/users.js`)

- alice: `alice@example.com` / `alice123`
- bob: `bob@example.com` / `bob456`

---

## 🛠️ Notes for beginners

- Never store plain passwords in source code in production.
- Always keep password logic inside the authentication flow, not at server startup.
- `bcrypt.compare` is used to validate credentials safely.

Phase 1 done! 🎉
Here's what we built and why it matters:
POST /auth/login
↓
validate input → 400 if missing
↓
find user by email → 401 if not found (generic message)
↓
bcrypt.compare → 401 if wrong password (same generic message)
↓
200 + user object → never send the password back

The two security principles we already have in place even at this basic stage — always return the same error message for wrong user or wrong password, and never send the hash back in the response. Both of these matter at scale.
