// Usage: node reset-admin.js <newPassword>
// Example: node reset-admin.js MyNewPass123
require("dotenv").config({ path: __dirname + "/.env" });
const bcrypt = require("bcrypt");
const { Client } = require("pg");

const newPassword = process.argv[2];
if (!newPassword || newPassword.length < 8) {
  console.error("Алдаа: Нууц үгийг аргумент болгон өгнө үү (хамгийн багадаа 8 тэмдэгт)");
  console.error("  node reset-admin.js <шинэ нууц үг>");
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const res = await client.query(
      "UPDATE users SET password_hash=$1, profile_complete=true WHERE role='admin' RETURNING username, full_name",
      [hash]
    );
    if (res.rows.length === 0) {
      console.error("Admin хэрэглэгч олдсонгүй.");
      process.exit(1);
    }
    res.rows.forEach((u) =>
      console.log(`✓ "${u.username}" (${u.full_name}) — нууц үг амжилттай солигдлоо.`)
    );
  } finally {
    await client.end();
  }
})();
