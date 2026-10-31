// Resets a local account's password to a new random value (printed once) and
// forces a password change at next login. Use when the admin password is lost:
//
//   docker compose exec app node migrations/tools/reset_admin_password.js [username]
//
// username defaults to ADMIN_USERNAME, or "admin".
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { pool } from '../../config/config.js';
import { printAdminBanner } from '../lib/seed.js';

async function run() {
  const username = (process.argv[2] || process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(password, 10);
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE, is_active = TRUE
     WHERE LOWER(username) = $2 AND auth_source = 'local'`,
    [hash, username]
  );
  if (!rowCount) throw new Error(`No local account named "${username}"`);
  printAdminBanner({ created: true, generated: true, username, password, title: "Password reset" });
}

run()
  .catch((err) => { console.error('Reset failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
