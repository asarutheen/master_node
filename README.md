# Login Service

## Overview

A scalable Node.js authentication service with Redis-backed token management, supporting multi-device logins, refresh token rotation, and security best practices.

## Phase 6: Architect Thinking ✅

### How It Works

Before writing code, understand how big companies scale login systems. This phase covers real-world scenarios that break under high traffic and their solutions.

#### Key Concepts (Beginner-Friendly)

- **Horizontal Scaling**: Multiple servers behind a load balancer distribute load.
- **Caching**: Redis stores frequently accessed data to reduce DB queries.
- **Async Processing**: Use queues (e.g., Kafka) for non-blocking operations like logging.
- **Token Rotation**: Issue new refresh tokens on use to detect theft.

### Scenarios and Solutions

#### Scenario 1: Traffic Spike

**Problem**: Viral growth causes 1,000,000 logins/hour. bcrypt and DB queries overload the system.

**Solution**:

- Horizontal scaling: Split load across servers.
- Caching: Check Redis for user data first.
- Read replicas: Route reads to replicas, writes to primary.
- Async queues: Push audit logs to Kafka after response.

**Flow at Scale**:

```
POST /auth/login
↓
Load balancer → least busy server
↓
Redis cache → user exists? (1ms hit)
↓ cache miss → PostgreSQL replica (10ms)
↓
bcrypt.compare() (CPU work)
↓
PostgreSQL primary → INSERT audit_log
↓
Kafka queue → async processing
↓
Response sent
```

#### Scenario 2: Credential Stuffing Attack

**Problem**: Attackers use botnets to test millions of email/password combos.

**Current Defenses**:

- Rate limiter: 10 req/15min per IP
- Account lockout: 5 failed attempts

**Why Insufficient**: Botnets use many IPs, avoiding triggers.

**Solutions**:

- **Layer 1: IP Reputation** - Block known bot IPs, Tor nodes.
- **Layer 2: Velocity Checks** - Detect same password across accounts.
- **Layer 3: Device Fingerprinting** - New device/location = suspicious.
- **Layer 4: Breach Detection** - Check against breached password lists.
- **Layer 5: ML Anomaly** - Flag unusual patterns.

#### Scenario 3: Token Theft

**Problem**: Stolen refresh tokens allow indefinite access.

**Solution: Refresh Token Rotation**

- On refresh, issue new refresh token, blacklist old one.
- Detect reuse: If old token used again, assume theft → blacklist all user tokens.

#### Scenario 4: Database Down

**Problem**: DB crash logs out all users.

**Solution**:

- Auto-failover to replicas.
- Cached data in Redis keeps logins working.
- JWTs are stateless, so verification continues.

### Practical Examples

#### Successful Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "password123"}'
# Response: { "accessToken": "...", "refreshToken": "..." }
```

#### Error Cases

- **Invalid Credentials**:
  ```json
  { "error": "Invalid email or password" }
  ```
- **Rate Limited**:
  ```json
  { "error": "Too many requests" }
  ```
- **Blacklisted Token**:
  ```json
  { "error": "Token has been revoked" }
  ```

### Project Structure

```
login-service/
├── src/
│   ├── app.js
│   ├── config/
│   │   ├── db.js
│   │   ├── env.js
│   │   └── redis.js
│   ├── modules/auth/
│   │   ├── auth.controller.js
│   │   ├── auth.repository.js
│   │   ├── auth.routes.js
│   │   └── auth.service.js
│   └── shared/
│       ├── middleware/
│       │   ├── authorize.js
│       │   ├── rateLimiter.js
│       │   └── verifyToken.js
│       └── utils/
│           ├── asyncHandler.js
│           ├── auditLog.js
│           └── tokenStore.js
├── server.js
├── package.json
└── README.md
```

### Test Users

- **Alice**: alice@example.com / password123 (admin)
- **Bob**: bob@example.com / password456 (user)
- **Charlie**: charlie@example.com / password789 (suspended)

### Curl/Postman Testing Guide

1. **Login**:
   ```
   POST /auth/login
   Body: { "email": "alice@example.com", "password": "password123" }
   ```
2. **Refresh Token**:
   ```
   POST /auth/refresh
   Body: { "refreshToken": "your_token" }
   ```
3. **Logout**:
   ```
   POST /auth/logout
   Headers: Authorization: Bearer <accessToken>
   ```

### Security Checklist

- [x] Password hashing with bcrypt
- [x] JWT tokens with expiration
- [x] Refresh token rotation
- [x] Rate limiting
- [x] Account lockout
- [x] Redis blacklisting
- [x] IP reputation checks (future)
- [x] Device fingerprinting (future)
- [ ] MFA support
- [ ] Audit logging to external service

### FAQ

**Q: Why Redis over in-memory?**  
A: Persists across restarts and scales across servers.

**Q: How does multi-device login work?**  
A: Each device gets a unique refresh token stored in a Redis Set per user.

**Q: What if Redis is down?**  
A: Falls back to in-memory for blacklisting; token checks fail open.

**Q: How to handle password resets?**  
A: Use email service (future phase) to send reset links with short-lived tokens.
Before we write a single line of code, let me give you the mental model of how big companies think about login systems at scale.
First — the numbers:
Your current system Production at scale
────────────────── ───────────────────
1 server 100+ servers
~10 req/sec 100,000+ req/sec
1 PostgreSQL Primary + 5 read replicas
No cache Redis cluster
In-memory blacklist Distributed Redis cache
Manual monitoring Real-time alerts + dashboards
The question is — what breaks first when traffic grows?
Let's find out by going through real world scenarios one by one.

Scenario 1 — The traffic spike
Normal day → 1,000 logins/hour
Product goes viral
↓
Sudden spike → 1,000,000 logins/hour
↓
What happens to your current system?
Every login does this:
POST /auth/login
↓
bcrypt.compare() ← CPU intensive, takes ~100ms
↓
SELECT FROM users ← DB query
↓
INSERT INTO login_attempts ← DB query
↓
INSERT INTO audit_logs ← DB query
↓
response
At 1000 logins/second:
bcrypt → 1000 × 100ms = 100 seconds of CPU work per second
server falls over immediately

DB queries → 3 queries × 1000/sec = 3000 queries/sec
PostgreSQL default max = 100 connections
connection pool exhausted in seconds
How big companies solve this:
Problem 1 — bcrypt CPU cost
↓
Solution — horizontal scaling
Multiple server instances behind a load balancer
1000 logins/sec split across 10 servers = 100/sec each
Each server handles bcrypt comfortably
Problem 2 — DB overload
↓
Solution A — connection pooling (we have this)
Solution B — PgBouncer (connection pooler in front of PostgreSQL)
Solution C — read replicas (writes go to primary, reads go to replicas)
Solution D — cache frequently read data in Redis
The login flow at scale looks like this:
POST /auth/login
↓
Load balancer → routes to least busy server
↓
Redis cache → check if user exists in cache first
↓ cache hit (fast, ~1ms)
Return cached user → skip DB entirely
↓ cache miss (slow, ~10ms)
PostgreSQL replica → SELECT FROM users (read replica, not primary)
↓
Store in Redis cache → next request served from cache
↓
bcrypt.compare() → CPU work, unavoidable
↓
PostgreSQL primary → INSERT audit_log (write, must go to primary)
↓
Kafka queue → push login event (async, never blocks response)
↓
Response sent → client gets token
↓ (async, after response)
Worker reads Kafka → processes audit log, sends alerts if needed

Scenario 2 — Credential stuffing attack
This is the most common real world attack on login systems:
Attacker buys 100 million email/password combos from dark web
↓
Writes a bot that tries each combo against your login endpoint
↓
At 10,000 req/sec — tests all 100M combos in 3 hours
↓
For every successful login — account is compromised
Your current defence:
Rate limiter → 10 req per 15 mins per IP
Account lockout → 5 failed attempts
Why this isn't enough:
Attacker uses 10,000 different IPs (botnet)
↓
Each IP only makes 1 request
↓
Rate limiter never triggers
↓
10,000 different accounts each get 1 attempt
↓
Account lockout never triggers (needs 5 from same account)
↓
If 1% of combos match → 100,000 accounts compromised
How big companies solve this:
Layer 1 — IP reputation check
↓
Known botnet IP? → block immediately
Tor exit node? → block or require CAPTCHA
Data center IP? → suspicious, require CAPTCHA
↓

Layer 2 — Velocity checks (Redis based)
↓
Same password tried against 100 different accounts in 1 min?
→ looks like credential stuffing
→ block all those IPs
→ alert security team
↓

Layer 3 — Device fingerprinting
↓
New device + new location + first login attempt = suspicious
→ require email verification before issuing token
↓

Layer 4 — Breach detection
↓
Password matches a known breached password list?
→ force password reset even if login succeeds
→ "We detected your password was in a data breach"
↓

Layer 5 — ML anomaly detection
↓
Login pattern doesn't match user's history?
→ flag for review
→ require additional verification

Scenario 3 — Token theft
Attacker intercepts a refresh token somehow
↓
Uses it to get new access tokens forever
↓
Original user has no idea
How big companies solve this — Refresh Token Rotation:
User logs in
↓
Gets refreshToken_v1
↓
Calls /auth/refresh with refreshToken_v1
↓
Server issues:

- new accessToken
- new refreshToken_v2 ← brand new refresh token
- blacklists refreshToken_v1 ← old one is dead immediately
  ↓
  Now if attacker tries refreshToken_v1
  ↓
  "Token has been revoked" → blocked
  But what if attacker uses it FIRST?
  Attacker uses refreshToken_v1 → gets refreshToken_v2
  ↓
  Legitimate user uses refreshToken_v1 → already used!
  ↓
  Server detects reuse of a token that was already rotated
  ↓
  This means token was stolen
  ↓
  Blacklist ALL tokens for this user
  ↓
  Force re-login on all devices
  ↓
  Alert the user — "suspicious activity detected"
  This is called refresh token reuse detection — used by Google, GitHub, and Spotify.

Scenario 4 — Database goes down
PostgreSQL primary crashes at 3am
↓
Every login fails
↓
Every token refresh fails
↓
All users logged out effectively
How big companies solve this:
Primary DB crashes
↓
Automatic failover (30-60 seconds)
↓
Read replica promoted to primary
↓
New replica spun up
↓
System recovers automatically
↓
Most users never notice
For login specifically:
DB down
↓
Redis still has cached user data
↓
Token verification still works (no DB needed — JWT is stateless)
↓
New logins fail (need DB to verify password)
↓
Existing logged in users unaffected
↓
Circuit breaker fires — stops hammering dead DB
↓
Returns "service temporarily unavailable" instead of hanging

What we're building in Phase 6:
Step 1 ✓ Restructured codebase (done)
Step 2 → Redis integration - token blacklist (replace in-memory Set) - user cache (skip DB on repeat logins) - distributed rate limiting (works across servers)

Step 3 → Refresh token rotation - reuse detection - automatic all-device logout on theft

Step 4 → Circuit breaker pattern - DB goes down → graceful degradation - Redis goes down → fallback to DB

Step 5 → Observability - structured logging - health check endpoint (detailed) - metrics endpoint (login rate, failure rate, latency)

Step 6 → Security hardening - helmet.js (HTTP security headers) - CORS configuration - request ID tracing

Let me re-map everything we just covered to AWS:

Scenario 1 — Traffic spike (AWS view)
Your Node.js servers
↓
AWS Elastic Load Balancer (ALB)
↓
Auto Scaling Group
↓
EC2 instances (your Node.js app)
When traffic spikes:
CloudWatch detects CPU > 70%
↓
Auto Scaling policy triggers
↓
New EC2 instances spin up automatically
↓
ALB routes traffic to new instances
↓
Traffic spike handled
↓
Spike ends → instances scale back down
→ you only pay for what you used
Database layer:
PostgreSQL on your laptop
↓
AWS RDS PostgreSQL
↓
Multi-AZ deployment

- Primary RDS in us-east-1a
- Standby RDS in us-east-1b ← automatic failover
  ↓
  RDS Read Replicas
- All SELECT queries → read replica
- All INSERT/UPDATE → primary
  ↓
  PgBouncer replaced by
  RDS Proxy ← AWS managed connection pooler
  sits between your app and RDS
  handles thousands of connections efficiently
  Cache layer:
  In-memory Redis (your laptop)
  ↓
  AWS ElastiCache (Redis)
  ↓
  Cluster mode enabled
- Multiple Redis nodes
- Data sharded across nodes
- One node goes down → others take over
  Full AWS login architecture:
  User
  ↓
  Route 53 ← DNS
  ↓
  CloudFront ← CDN + DDoS protection (free tier)
  ↓
  WAF ← Web Application Firewall
  blocks known bad IPs
  rate limiting at edge
  OWASP rule sets (SQL injection etc.)
  ↓
  ALB ← Load balancer
  ↓
  Auto Scaling Group of EC2 ← your Node.js servers
  ↓
  ElastiCache Redis ← token blacklist, user cache, rate limiting
  ↓
  RDS Proxy ← connection pooling
  ↓
  RDS PostgreSQL ← primary (writes)
  RDS Read Replica ← replica (reads)

Scenario 2 — Credential stuffing (AWS view)
Your current defence
↓
express-rate-limit (single server, in-memory)

Problem
↓
Doesn't work across multiple EC2 instances
Instance A knows about the rate limit
Instance B has no idea — fresh counter
↓
Attacker hits Instance A 9 times, Instance B 9 times
↓
Rate limit never triggers on either
AWS solution:
Layer 1 — AWS WAF
↓
Managed rule groups:

- AWS IP Reputation list ← known bad actors blocked at edge
- Anonymous IP list ← Tor, VPNs flagged
- Bot Control ← detects automated traffic
  ↓
  All before traffic even hits your EC2

Layer 2 — AWS Shield
↓
Standard (free) → DDoS protection at network level
Advanced (paid) → sophisticated DDoS, 24/7 AWS DDoS response team

Layer 3 — ElastiCache Redis rate limiting
↓
Replaces express-rate-limit
All EC2 instances share the same Redis counter
Attacker hits Instance A 5 times + Instance B 5 times
↓
Redis counter = 10 → rate limit triggers correctly

Scenario 3 — Token theft (AWS view)
Refresh tokens stored in
↓
ElastiCache Redis
↓
Key: refresh_token:<token_hash>
Value: { userId, isValid, createdAt }
TTL: 7 days (auto expires — no cleanup needed)
↓
On rotation:
DELETE old token from Redis
SET new token in Redis
↓
On reuse detection:
SCAN all keys for this userId
DELETE all of them
Force re-login on all devices
AWS security extras:
AWS Secrets Manager
↓
JWT_SECRET stored here, not in .env
↓
EC2 instances fetch secret at startup
↓
Secret rotated automatically every 30 days
↓
Your app gets new secret without redeployment
↓
Even if someone gets your .env — secret is already rotated

Scenario 4 — Database goes down (AWS view)
RDS Multi-AZ handles this automatically:

Primary RDS crashes
↓
AWS detects failure (30-60 seconds)
↓
DNS automatically points to standby
↓
Standby promoted to primary
↓
New standby created in background
↓
Your app reconnects automatically
↓
Most users never notice
Circuit breaker on AWS:
Your Node.js app
↓
opossum (circuit breaker library)
↓
DB calls fail 5 times in 10 seconds
↓
Circuit OPENS
↓
Stops calling DB entirely for 30 seconds
↓
Returns cached data from ElastiCache
↓
CloudWatch alarm fires
↓
SNS notification → your phone gets an SMS
↓
After 30 seconds — circuit tries DB again
↓
DB recovered → circuit CLOSES → normal operation

Observability on AWS:
Your app AWS service
────────── ───────────
console.log() → CloudWatch Logs
(all EC2 instances stream logs here)

Custom metrics → CloudWatch Metrics
login rate (graphs, dashboards)
failure rate
latency

Alerts → CloudWatch Alarms → SNS → your phone
"failure rate > 5%"
"latency > 500ms"
"DB connections > 80%"

Request tracing → AWS X-Ray
see exactly where (trace a single login request
each request spent across EC2, RDS, ElastiCache)
time

The full AWS bill estimate for this system:
Service Cost/month (approximate)
─────── ────────────────────────
EC2 (2x t3.medium) ~$60
RDS (db.t3.medium) ~$50
RDS Read Replica ~$50
ElastiCache (t3.micro) ~$15
ALB ~$20
WAF ~$10 + $1 per million requests
CloudFront ~$5
Route 53 ~$0.50 per hosted zone
Secrets Manager ~$0.40 per secret
────────
Total ~$210/month

At startup scale → use RDS free tier + ElastiCache free tier
→ brings it down to ~$30/month

Now with that AWS context in mind — here's how we'll build Redis integration in our code:
ElastiCache Redis (AWS) = Redis running locally for now
same code, just different connection string
.env: REDIS_URL=redis://localhost:6379
AWS: REDIS_URL=redis://your-elasticache-endpoint:6379
One line change in .env and your code works on AWS ElastiCache.
Install Redis locally first:
bash# Mac
brew install redis
brew services start redis

# Ubuntu

sudo apt install redis-server
sudo systemctl start redis

# verify its running

redis-cli ping

# should return PONG

Then install the Redis client:
bashnpm install ioredis
We use ioredis not the official redis package because:
ioredis → better cluster support, auto reconnect,
used by Alibaba, Netflix, Segment
redis (official) → simpler but weaker cluster/failover support
On AWS ElastiCache cluster mode — ioredis handles it natively. The official client needs extra configuration.

1 — Persistence across restarts:
Old (in-memory Set) New (Redis)
─────────────────── ───────────
Server restarts at 3am Server restarts at 3am
Blacklist wiped Blacklist intact in Redis
Stolen tokens valid again Stolen tokens still blocked
2 — Works across all EC2 instances:
Old New
─── ───
Instance A blacklists token Redis blacklists token
Instance B has no idea All instances check same Redis
Attacker hits Instance B Attacker blocked on all instances
Token works Token blocked everywhere
3 — Auto expiry — no cleanup job needed:
Old New
─── ───
Set grows forever Redis TTL auto-deletes after 7 days
Manual cleanup every hour No maintenance needed
Memory leak risk Bounded memory guaranteed
4 — Multi-device session management:
refresh:1 → Set { token_phone, token_laptop, token_tablet }
↑
Alice logged in on 3 devices

Alice changes password
↓
removeAllRefreshTokens(1)
↓
redis.del("refresh:1")
↓
All 3 devices logged out instantly
↓
Next refresh attempt on any device
↓
"Token revoked. Please log in again."
On AWS this maps to:
ElastiCache Redis Cluster
↓
refresh:1 lives on shard 1
refresh:2 lives on shard 2
blacklist:\* spread across shards
↓
ioredis cluster mode handles routing automatically
↓
You write the same code — ioredis figures out which shard to hit

The three caching patterns we now support:
Cache-Aside (what we built):
App checks cache first
↓
Miss → fetch from DB → store in cache
Hit → return from cache
↓
App manages the cache explicitly
Used for: user data, product data, anything read-heavy
Write-Through (for future consideration):
App writes to DB
↓
Simultaneously writes to cache
↓
Cache always in sync with DB
Used for: data that's written and read equally
Write-Behind (advanced):
App writes to cache only
↓
Cache asynchronously writes to DB
↓
Extremely fast writes
Risk: data loss if cache dies before DB write
Used for: audit logs, analytics, non-critical writes
On AWS these patterns map to:
Cache-Aside → ElastiCache + RDS (most common pattern)
Write-Through → ElastiCache write-through policy
Write-Behind → ElastiCache + SQS queue + Lambda writer

Here's the complete picture of what happens on every login now:
POST /auth/login
↓
loginRateLimiter ← Redis: check IP request count
↓
checkLockout ← PostgreSQL: check failed attempts
↓
getCachedUser ← Redis: user data (~1ms)
↓ cache miss
findUserByEmail ← PostgreSQL: (~10ms)
setCachedUser ← Redis: store for next time
↓
bcrypt.compare ← CPU: (~100ms) unavoidable
↓
signAccessToken ← CPU: (~1ms)
signRefreshToken ← CPU: (~1ms)
storeRefreshToken ← Redis: store active token
↓
log(LOGIN_SUCCESS) ← PostgreSQL: audit log (async)
↓
Response sent ← total: ~115ms
On AWS this entire flow runs across:
EC2 → bcrypt, JWT signing
ElastiCache → rate limit, user cache, token store
RDS Replica → user lookup (read)
RDS Primary → audit log (write)

Now the full login flow is optimised end to end:
POST /auth/login
↓
checkLockout ← Redis GET lockout:email (~1ms)
↓
getUser ← Redis GET user:email (~1ms) cache hit
← PostgreSQL SELECT (~10ms) cache miss
↓
bcrypt.compare ← CPU (~100ms)
↓
handleFailedAttempt← Redis INCR attempts:email (~1ms) on failure
↓
storeRefreshToken ← Redis SADD refresh:userId (~1ms)
↓
log audit ← PostgreSQL INSERT (async, non-blocking)
↓
response ← total ~105ms
PostgreSQL now only handles:
PostgreSQL touches per login
────────────────────────────
User lookup → only on cache miss (first login, or after 1hr TTL)
Audit log → async, never blocks response
Everything else is Redis — this is how big companies achieve sub-100ms login at millions of requests per second.
On AWS this maps to:
ElastiCache Redis
lockout:alice@example.com → "2024-01-01T10:15:00Z" TTL: 900s
attempts:alice@example.com → "3" TTL: 900s
user:alice@example.com → { id, name, email, role } TTL: 3600s
refresh:1 → Set { token1, token2 } TTL: 604800s
blacklist:eyJhbG... → "revoked" TTL: 604800s
ratelimit:::1 → "7" TTL: 900s

RDS PostgreSQL
users table → source of truth for user data
audit_logs table → permanent login history
