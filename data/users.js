// Added role field and twoFactorSecret to each user
// In Phase 6 (PostgreSQL) these will be columns in the users table
//
// Plain text passwords for testing:
//   alice@example.com  →  alice123  (admin)
//   bob@example.com    →  bob456    (user)

const users = [
  {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    password: "$2b$10$Rh/uJHKCGv8jIFObkjAuc.8NhPTFqA6XBnL7Zw4RGiFI..MsSDinS",
    role: "admin",
    twoFactorSecret: "LMYTKMZFLUZU4LCYOZFCYMS2OI6E2ZDFKQQS4MLBFZFHKOSWJAZA", // null = 2FA not enabled for this user
  },
  {
    id: 2,
    name: "Bob",
    email: "bob@example.com",
    password: "$2b$10$02Cd7hu7kxnHVCgjz/hS0uiKUdMnkMJAPw9oqDExhBz5jwbUbgdDi",
    role: "user",
    twoFactorSecret: null,
  },
];

function findUserByEmail(email) {
  return users.find((u) => u.email === email.toLowerCase().trim()) || null;
}

function findUserById(id) {
  return users.find((u) => u.id === id) || null;
}

module.exports = { findUserByEmail, findUserById };
