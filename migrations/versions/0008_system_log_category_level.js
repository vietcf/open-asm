// 0008_system_log_category_level
// system_log is split in two streams shown on separate tabs:
//   category 'security'  security audit: sign-in/out, 2FA, passwords, users,
//                        roles, permissions, system configuration
//   category 'app'       application log: changes to assets and other data
// and gets a level (info / warning / critical), used by the log_level
// setting and the log page filters.
// Existing rows are classified by classify(), which
// migrations/data/migrate_data.js also replays after copying older data.

// Rows of older versions that belong to the security audit. Keep in sync
// with SECURITY_ACTIONS / SECURITY_PATH_PREFIXES in src/utils/logHelper.js.
const SECURITY_ACTIONS = ['login', 'logout', '2fa', 'change_password'];

export async function classify(db) {
  await db.query(
    `UPDATE system_log SET category = 'security'
      WHERE category <> 'security' AND (action = ANY($1) OR object_type IN ('user', 'role', 'permission', 'configuration'))`,
    [SECURITY_ACTIONS]
  );
  await db.query(
    `UPDATE system_log SET level = 'warning'
      WHERE level = 'info' AND lower(coalesce(status, '')) IN ('failed', 'failure', 'error', 'denied')`
  );
}

export async function up(db) {
  await db.query(`
    ALTER TABLE system_log
      ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'app' CHECK (category IN ('app', 'security')),
      ADD COLUMN level VARCHAR(10) NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical'))
  `);
  await db.query('CREATE INDEX idx_system_log_category_created ON system_log (category, created_at DESC)');
  await classify(db);
}
