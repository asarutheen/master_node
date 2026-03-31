# Login Rate Limiting + Account Lockout

## Phase status

- ✅ Phase 2: Login abuse protection (rate limit + lockout)
- ⏳ Phase 3+: frontend retry and adaptive lockout improvements

## What we're building

1. Failed-login lockout:
   - 5 failed attempts → account locked for 15 minutes
   - Any login attempt during lockout returns `"Account locked. Try again in X minutes."`
   - After 15 minutes, lock expires and counter resets
2. IP rate limiter:
   - limits how many requests can hit `/auth/login` from a single IP
   - excess requests return HTTP `429 Too Many Requests`

## How it works

- Layer 1: Rate limiter protects server capacity and helps slow brute-force from many IPs.
- Layer 2: Account lockout protects user account even if requests come from many IPs.

> Example attack scenarios:
>
> - 1000 IPs brute-forcing one account → layer 2 still locks after 5 failures.
> - 1000 usernames from one IP → layer 1 slows this to prevent overload.

### Account lockout details

- `recordFailedAttempt`: checks if previous lock expired first.
- If lock expired, counter resets to 1 to give user a fresh window.
- If still under lock, user gets remaining wait time.

## Practical examples

### 1. Normal login flow

- 1st to 5th failed attempts: `401 Invalid credentials`
- 6th attempt (in the same window): `423 Account locked. Try again in X minutes.`

### 2. After lock expires

- Wait 15 min
- Failed attempt → counter resets to 1
- You get 5 new attempts before lockout again

## Question (FAQ)

**Q: If I have 30+ URLs in my app, does rate limiting block access to all routes for 15 minutes?**

- No. The rate limiter is scoped specifically to `/auth/login` (or the selected endpoints).
- Other routes should remain accessible unless you add a global rate limiter.
- If you need per-route behavior, configure each route separately in your rate limiter middleware.

## Security checklist

- [x] Apply rate limits on auth endpoints
- [x] Account lockout after repeated failed logins
- [x] Provide lockout countdown in responses
- [ ] Add email notification for locked account (optional)
- [ ] Move quota/state to Redis for cluster support (future)
