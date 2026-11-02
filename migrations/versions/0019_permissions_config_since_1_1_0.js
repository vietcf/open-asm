// 0019_permissions_config_since_1_1_0
// `up` no longer seeds an existing database, so the seed data added after
// v1.1.0 reaches upgraded installs here instead:
//   permissions  service_mapping.create/read/update/delete,
//                backup.create/read/delete/restore (backups are never edited)
//   configuration backup_enabled, backup_frequency, backup_hour,
//                backup_retention, api_debug_log
// Permissions this migration creates are granted like the seed grants them:
// superadmin all; admin service_mapping.* (no backup: a dump holds password
// hashes); viewer service_mapping.read. Roles that do not exist are skipped
// (a fresh install is seeded right after the migrations). Existing
// permissions, grants and configuration values are left as they are.

const PERMISSIONS = [
  ['service_mapping.create', 'Create service mapping'],
  ['service_mapping.read', 'Read service mapping'],
  ['service_mapping.update', 'Update service mapping'],
  ['service_mapping.delete', 'Delete service mapping'],
  ['backup.create', 'Create backup'],
  ['backup.read', 'Read backup'],
  ['backup.delete', 'Delete backup'],
  ['backup.restore', 'Restore backup'],
];

const grantedTo = (role, name) =>
  role === 'superadmin'
  || (role === 'admin' && name.startsWith('service_mapping.'))
  || (role === 'viewer' && name === 'service_mapping.read');

export async function up(db) {
  const { rows: created } = await db.query(
    `INSERT INTO permissions (name, description) SELECT * FROM unnest($1::text[], $2::text[])
     ON CONFLICT (name) DO NOTHING RETURNING id, name`,
    [PERMISSIONS.map((p) => p[0]), PERMISSIONS.map((p) => p[1])]);
  const { rows: roles } = await db.query(`SELECT id, name FROM roles WHERE name IN ('superadmin', 'admin', 'viewer')`);
  for (const role of roles) {
    for (const perm of created.filter((p) => grantedTo(role.name, p.name))) {
      await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [role.id, perm.id]);
    }
  }
  if (created.length) console.log(`0019: added permissions ${created.map((p) => p.name).join(', ')}`);

  // Same defaults as the seed at this version (installs that set BACKUP_* in .env keep them)
  const frequency = ['daily', 'weekly', 'monthly'].includes(process.env.BACKUP_FREQUENCY) ? process.env.BACKUP_FREQUENCY : 'daily';
  const retention = /^[1-9][0-9]{0,2}$/.test(process.env.BACKUP_RETENTION || '') ? process.env.BACKUP_RETENTION : '7';
  const configs = [
    ['backup_enabled', 'on', 'Run the scheduled database backup (on / off)'],
    ['backup_frequency', frequency, 'Scheduled backup frequency (daily, weekly, monthly)'],
    ['backup_hour', '2', 'Hour of the day (0-23, server time) of the scheduled backup'],
    ['backup_retention', retention, 'Scheduled backups to keep'],
    ['api_debug_log', 'off', 'Log every REST API request with its JSON body, level debug (on / off)'],
  ];
  for (const [key, value, description] of configs) {
    await db.query('INSERT INTO configuration (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING', [key, value, description]);
  }
}
