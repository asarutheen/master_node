-- Users table
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password          VARCHAR(255) NOT NULL,
  role              VARCHAR(50)  NOT NULL DEFAULT 'user',
  two_factor_secret VARCHAR(255),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Login attempts table
CREATE TABLE login_attempts (
  email            VARCHAR(255) PRIMARY KEY,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMP,
  last_attempt     TIMESTAMP DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  event       VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  ip          VARCHAR(100),
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Seed users (same test users, same passwords)
INSERT INTO users (name, email, password, role) VALUES
  ('Alice', 'alice@example.com', '$2b$10$Rh/uJHKCGv8jIFObkjAuc.8NhPTFqA6XBnL7Zw4RGiFI..MsSDinS', 'admin'),
  ('Bob',   'bob@example.com',   '$2b$10$02Cd7hu7kxnHVCgjz/hS0uiKUdMnkMJAPw9oqDExhBz5jwbUbgdDi', 'user');