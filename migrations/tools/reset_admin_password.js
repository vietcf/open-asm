// Resets a local account's password to a new random value (printed once) and
// forces a password change at next login. Use when the admin password is lost
// or after restoring a backup:
//
//   docker compose exec app node migrations/tools/reset_admin_password.js [username] [--disable-2fa]
//
// username defaults to ADMIN_USERNAME, or "admin".
// --disable-2fa also turns off two-factor authentication for the account.
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { pool } from '../../config/config.js';
import { printAdminBanner } from '../lib/seed.js';

async function run() {
  const args = process.argv.slice(2);
  const disable2fa = args.includes('--disable-2fa');
  const username = (args.find(a => !a.startsWith('-')) || process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(password, 10);
  const twofaCols = disable2fa ? ', twofa_enabled = FALSE, twofa_secret = NULL' : '';
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE, is_active = TRUE${twofaCols}
     WHERE LOWER(username) = $2 AND auth_source = 'local'`,
    [hash, username]
  );
  if (!rowCount) throw new Error(`No local account named "${username}"`);
  printAdminBanner({ created: true, generated: true, username, password, title: "Password reset" });
  if (disable2fa) console.log('Two-factor authentication disabled for', username);
}

run()
  .catch((err) => { console.error('Reset failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
