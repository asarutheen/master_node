const users = [
  {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    password: "$2b$10$Rh/uJHKCGv8jIFObkjAuc.8NhPTFqA6XBnL7Zw4RGiFI..MsSDinS",
  },
  {
    id: 2,
    name: "Bob",
    email: "bob@example.com",
    password: "$2b$10$02Cd7hu7kxnHVCgjz/hS0uiKUdMnkMJAPw9oqDExhBz5jwbUbgdDi",
  },
];

// Plain text passwords for testing:
//   alice@example.com  →  alice123
//   bob@example.com    →  bob456

function findUserByEmail(email) {
  return users.find((u) => u.email === email.toLowerCase().trim()) || null;
}

module.exports = { findUserByEmail };
