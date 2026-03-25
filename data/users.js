const bcrypt = require("bcrypt");

// In Phase 1 we keep users in memory.
// Passwords are pre-hashed at startup so we never store plain text — even here.
// Phase 3+ will move this to PostgreSQL.

const plainUsers = [
  { id: 1, name: "Alice", email: "alice@example.com", password: "alice123" },
  { id: 2, name: "Bob", email: "bob@example.com", password: "bob456" },
  {
    id: 3,
    name: "Charlie",
    email: "charlie@example.com",
    password: "charlie789",
  },
];

// Hash all passwords once when the server starts
async function buildUsers() {
  const users = await Promise.all(
    plainUsers.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password: await bcrypt.hash(u.password, 10), // saltRounds = 10
    })),
  );
  return users;
}

// We export a promise — server.js will await this before starting
module.exports = buildUsers();
