# Login Service (JWT Auth)

## Phase status

- ✅ Phase 1: Basic access token + refresh token in endpoints
- ✅ Phase 2: Refresh token rotation + blacklist on logout
- ⏳ Phase 3: Full client auto-refresh flow (planned)

## Project structure

- `server.js` — Express server and route setup
- `routes/auth.js` — login/refresh/logout flows
- `middleware/auth.js` — access token protection (`verifyToken`)
- `data/users.js` — in-memory user store (`findUserByEmail`)
- `data/tokenStore.js` — in-memory blacklist store
- `.env` — secrets & expiration settings

## Test users

- alice@example.com / alice123
- bob@example.com / bob456

## How it works

### Auth flow

1. `POST /auth/login` with email/password
2. Validate credentials using `bcrypt.compare`
3. Issue:
   - Access token signed with `JWT_SECRET`, expires in 15m
   - Refresh token signed with `JWT_REFRESH_SECRET`, expires in 7d
4. `GET /profile`, `GET /dashboard` protected by `verifyToken`
5. `POST /auth/refresh` accepts refresh token, validates via `jwt.verify`
6. `POST /auth/logout` blacklists refresh token

### Security notes

- Access tokens are short-lived, so we don’t store or blacklist them in this phase.
- Refresh tokens are blacklisted on logout to prevent reuse.
- Use secure `JWT_SECRET` and `JWT_REFRESH_SECRET` in environment.

## Practical examples

### Login

Request:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}'
```

Response:

```json
{
  "success": true,
  "accessToken": "<JWT>",
  "refreshToken": "<JWT>"
}
```

### Refresh token

Request:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<JWT>"}'
```

Response:

```json
{
  "success": true,
  "accessToken": "<new JWT>"
}
```

### Logout

Request:

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<JWT>"}'
```

Response:

```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

## Error cases

- 400: missing email/password on login
- 401: invalid credentials on login
- 401: invalid/expired access token on protected routes
- 401: invalid/expired refresh token on refresh
- 401: blacklisted refresh token on refresh

## Curl/Postman testing guide

1. `POST /auth/login` → keep tokens.
2. `GET /profile` with `Authorization: Bearer <accessToken>`.
3. Wait 15m or set short expiry in `.env`.
4. `POST /auth/refresh` with refresh token, get new access token.
5. `POST /auth/logout` with refresh token.
6. `POST /auth/refresh` again should fail for blacklisted token.

## Security checklist

- [ ] Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in `.env`
- [ ] Use HTTPS in production
- [ ] Store refresh token securely (cookie or local storage with secure flags)
- [ ] Implement rate limiting for login/refresh endpoints
- [ ] Add DB-backed token store in phase 4+ for multi-instance support

## FAQ

**Q: Why keep both access and refresh tokens?**
A: Access tokens are short-lived and safe for APIs; refresh tokens avoid repeated logins.

**Q: Why not blacklist access tokens?**
A: Because they expire quickly and blacklisting each request is costly.

**Q: Can refresh tokens be rotated?**
A: Yes, planned in Phase 3 for better replay-protection.

**Q: What if a refresh token leaks?**
A: Revoke it via `/auth/logout` and pair with a short expiry + rotation in later phases.
