const bcrypt = require("bcrypt");

async function generateHashes() {
  const alice = await bcrypt.hash("alice123", 10);
  const bob = await bcrypt.hash("bob456", 10);

  console.log("alice hash:", alice);
  console.log("bob hash:  ", bob);
}

generateHashes();
