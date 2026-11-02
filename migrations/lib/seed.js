// Idempotent seed data: roles/permissions, default configuration and the
// initial administrator account. Every insert is ON CONFLICT DO NOTHING (or
// guarded by an existence check), so this runs safely on every deploy and
// never overwrites anything changed later through the UI.
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export async function seedPermissionsAndRoles(db) {
  // Seed roles
  await db.query(`
    INSERT INTO roles (name, description) VALUES
      ('superadmin', 'Full system administrator'),
      ('admin', 'System administrator'),
      ('viewer', 'Read-only user')
    ON CONFLICT (name) DO NOTHING;
  `);

  // Seed permissions
  const entities = [
    'user', 'device', 'device_type', 'domain', 'unit', 'tag', 'agent', 'contact',
    'server', 'subnet', 'platform', 'service', 'system', 'ip_address',
    'role', 'permission',
    'configuration', 'system_log',
    'priv_account', 'priv_role', 'priv_permission', 'rule', 'pentest', 'cluster',
    'backup'
  ];
  const actions = ['create', 'read', 'update', 'delete'];
  const permissionValues = [];
  for (const entity of entities) {
    for (const action of actions) {
      permissionValues.push(`('${entity}.${action}', '${action.charAt(0).toUpperCase() + action.slice(1)} ${entity.replace('_', ' ')}')`);
    }
  }
  permissionValues.push(`('backup.restore', 'Restore backup')`);
  // Backups are never edited: no backup.update
  const updateIdx = permissionValues.indexOf(`('backup.update', 'Update backup')`);
  if (updateIdx >= 0) permissionValues.splice(updateIdx, 1);
  await db.query(`
    INSERT INTO permissions (name, description) VALUES
      ${permissionValues.join(',\n      ')}
    ON CONFLICT (name) DO NOTHING;
  `);

  // Map role to permission
  // Get role ids
  const { rows: roleRows } = await db.query('SELECT id, name FROM roles');
  const { rows: permRows } = await db.query('SELECT id, name FROM permissions');
  const roleMap = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
  const permMap = Object.fromEntries(permRows.map(p => [p.name, p.id]));

  // Superadmin: all permissions
  for (const permId of Object.values(permMap)) {
    await db.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleMap['superadmin'], permId]
    );
  }
  // Admin: all except user, role, permission and backup (a dump holds password hashes)
  for (const permName of Object.keys(permMap)) {
    if (!permName.startsWith('user.') && !permName.startsWith('role.') && !permName.startsWith('permission.') && !permName.startsWith('backup.')) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['admin'], permMap[permName]]
      );
    }
  }
  // Viewer: read-only, except user, role, permission
  for (const permName of Object.keys(permMap)) {
    if (permName.endsWith('.read') && !permName.startsWith('user.') && !permName.startsWith('role.') && !permName.startsWith('permission.') && !permName.startsWith('backup.')) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['viewer'], permMap[permName]]
      );
    }
  }
}

export async function seedConfiguration(db) {
  // Default configuration (ON CONFLICT DO NOTHING: never overwrites values edited in the UI)
  const simpleConfigs = [
    ['site_name', process.env.SITE_NAME || 'Open ASM', 'Site name shown in the header and page titles'],
    ['page_size', '10,20,50', 'Page size options for list pages'],
    ['log_level', 'info', 'Minimum level of system log entries (info, warning, critical)'],
    ['log_retention_days', '30', 'Days to keep system log entries'],
    // Backup schedule: installs that set it in .env keep their values
    ['backup_enabled', 'on', 'Run the scheduled database backup (on / off)'],
    ['backup_frequency', ['daily', 'weekly', 'monthly'].includes(process.env.BACKUP_FREQUENCY) ? process.env.BACKUP_FREQUENCY : 'daily', 'Scheduled backup frequency (daily, weekly, monthly)'],
    ['backup_hour', '2', 'Hour of the day (0-23, server time) of the scheduled backup'],
    ['backup_retention', /^[1-9][0-9]{0,2}$/.test(process.env.BACKUP_RETENTION || '') ? process.env.BACKUP_RETENTION : '7', 'Scheduled backups to keep'],
  ];
  for (const [key, value, description] of simpleConfigs) {
    await db.query(
      'INSERT INTO configuration (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
      [key, value, description]
    );
  }

  // Initial values for the list-type configurations
  const dynamicConfigs = [
    {
      key: 'firewall_name',
      value: [
        { value: 'USER', label: 'USER' },
        { value: 'SERVER', label: 'SERVER' },
        { value: 'INTERNET-IN', label: 'INTERNET-IN' },
        { value: 'INTERNET-OUT', label: 'INTERNET-OUT' },
        { value: 'BACKBOND', label: 'BACKBOND' },
        { value: 'DMZ', label: 'DMZ' },
        { value: 'PARTNER', label: 'PARTNER' },
        { value: 'DIGI', label: 'DIGI' }
      ],
      description: 'Firewall names'
    },
    {
      key: 'priv_account_type',
      value: [
        { value: 'OS', label: 'Operating System (OS)' },
        { value: 'APP', label: 'Application (APP)' },
        { value: 'DB', label: 'Database (DB)' }
      ],
      description: 'Privileged account types'
    },
    {
      key: 'priv_account_manage_type',
      value: [
        { value: 'SELF', label: 'Self-managed' },
        { value: 'PAM', label: 'Managed by PAM' },
        { value: 'ENVELOPE', label: 'Envelope method' }
      ],
      description: 'Privileged account management methods'
    },
    {
      key: 'device_location',
      value: [
        { value: 'DC', label: 'Data Center DC' },
        { value: 'DR', label: 'Data Center DR' },
        { value: 'CMC', label: 'CMC Data Center' },
        { value: 'BRANCH', label: 'Branch Office' }
      ],
      description: 'Server / device locations'
    },
    {
      key: 'firewall_rule_action',
      value: [
        { value: 'ALLOW', label: 'Allow' },
        { value: 'DENY', label: 'Deny' }
      ],
      description: 'Firewall rule actions'
    },
    {
      key: 'firewall_rule_status',
      value: [
        { value: 'DONE', label: 'Done' },
        { value: 'INPROCESS', label: 'Inprocess' }
      ],
      description: 'Firewall rule processing statuses'
    },
    {
      key: 'firewall_rule_violation_type',
      value: [
        { value: 'SECURITY_VIOLATION', label: 'Security Violation' },
        { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
        { value: 'COMPLIANCE_VIOLATION', label: 'Compliance Violation' },
        { value: 'BEST_PRACTICE_VIOLATION', label: 'Best Practice Violation' }
      ],
      description: 'Firewall rule violation types'
    },
    {
      key: 'ip_address_type',
      value: [
        { value: 'STATIC', label: 'Static' },
        { value: 'DYNAMIC', label: 'Dynamic' }
      ],
      description: 'IP address types'
    },
    {
      key: 'server_type',
      value: [
        { value: 'PHYSICAL', label: 'PHYSICAL' },
        { value: 'VIRTUAL-MACHINE', label: 'VIRTUAL-MACHINE' },
        { value: 'CLOUD-INSTANCE', label: 'CLOUD-INSTANCE' }
      ],
      description: 'Server types'
    },
    {
      key: 'server_status',
      value: [
        { value: 'ONLINE', label: 'ONLINE' },
        { value: 'OFFLINE', label: 'OFFLINE' },
        { value: 'MAINTENANCE', label: 'MAINTENANCE' }
      ],
      description: 'Server statuses'
    },
    {
      key: 'network_domain_record_type',
      value: [
        { value: 'A', label: 'A' },
        { value: 'AAAA', label: 'AAAA' },
        { value: 'CNAME', label: 'CNAME' },
        { value: 'MX', label: 'MX' },
        { value: 'TXT', label: 'TXT' },
        { value: 'NS', label: 'NS' },
        { value: 'SRV', label: 'SRV' },
        { value: 'PTR', label: 'PTR' },
        { value: 'SOA', label: 'SOA' },
        { value: 'OTHER', label: 'Other' }
      ],
      description: 'DNS record types'
    },
    {
      key: 'pentest_status',
      value: [
        { value: 'NOT_STARTED', label: 'Not Started' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED_UNFIXED', label: 'Completed - Unfixed' },
        { value: 'COMPLETED_FIXED', label: 'Completed - Fixed' }
      ],
      description: 'Pentest round statuses'
    },
    {
      key: 'system_app_type',
      value: [
        { value: 'web', label: 'Web App' },
        { value: 'mobile', label: 'Mobile App' }
      ],
      description: 'App types for system components'
    },
    {
      key: 'system_level',
      value: [
        { value: '1', label: 'Level 1' },
        { value: '2', label: 'Level 2' },
        { value: '3', label: 'Level 3' },
        { value: '4', label: 'Level 4' },
        { value: '5', label: 'Level 5' }
      ],
      description: 'Information system levels'
    },
    {
      key: 'ip_address_status',
      value: [
        { value: 'reserved', label: 'Reserved' },
        { value: 'assigned', label: 'Assigned' },
        { value: 'inactive', label: 'Inactive' }
      ],
      description: 'IP address statuses'
    },
    {
      key: 'system_user_scope',
      value: [
        { value: 'public-internet', label: 'Public Internet' },
        { value: 'internal', label: 'Internal' },
        { value: 'external-vpn', label: 'External VPN' },
        { value: 'public-restricted-ip', label: 'Public Restricted IP' }
      ],
      description: 'System user scopes'
    },
    {
      key: 'system_arch',
      value: [
        { value: 'web', label: 'Web' },
        { value: 'api', label: 'API' },
        { value: 'job', label: 'Job' },
        { value: 'service', label: 'Service' },
        { value: 'mobile', label: 'Mobile' },
        { value: 'desktop-db', label: 'Desktop DB' },
        { value: 'desktop-ws-service', label: 'Desktop WS Service' },
        { value: 'win-app', label: 'Windows App' }
      ],
      description: 'System architectures'
    },
    {
      key: 'contact_position',
      value: [
        { value: 'Manager', label: 'Manager' },
        { value: 'Staff', label: 'Staff' },
        { value: 'Accountant', label: 'Accountant' },
        { value: 'Engineer', label: 'Engineer' },
        { value: 'Technician', label: 'Technician' },
        { value: 'Director', label: 'Director' },
        { value: 'Supervisor', label: 'Supervisor' },
        { value: 'Analyst', label: 'Analyst' },
        { value: 'Developer', label: 'Developer' },
        { value: 'Administrator', label: 'Administrator' }
      ],
      description: 'Contact positions'
    }
  ];
  for (const conf of dynamicConfigs) {
    if (conf.description) {
      await db.query(
        `INSERT INTO configuration (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING;`,
        [conf.key, JSON.stringify(conf.value), conf.description]
      );
    } else {
      await db.query(
        `INSERT INTO configuration (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING;`,
        [conf.key, JSON.stringify(conf.value)]
      );
    }
  }

}

// Creates the initial administrator account — only when the database has no
// superadmin user at all (i.e. the first install). Never touches an existing
// account, so changing the admin password in the UI is permanent.
//
//   ADMIN_USERNAME  default "admin"
//   ADMIN_EMAIL     default "admin@localhost"
//   ADMIN_PASSWORD  if empty, a random password is generated and printed once
//                   to the log (docker compose logs app)
//
// Either way the account is flagged must_change_password, so the first login
// forces the operator to pick their own password.
export async function ensureAdminUser(db, env = process.env) {
  const { rows: roleRows } = await db.query(`SELECT id FROM roles WHERE name = 'superadmin' LIMIT 1`);
  if (!roleRows.length) throw new Error('Role superadmin not found');
  const superadminRoleId = roleRows[0].id;

  const { rows: existing } = await db.query(
    'SELECT username FROM users WHERE role_id = $1 LIMIT 1',
    [superadminRoleId]
  );
  if (existing.length) {
    return { created: false, username: existing[0].username };
  }

  const username = (env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const email = (env.ADMIN_EMAIL || 'admin@localhost').trim().toLowerCase();
  const fromEnv = Boolean(env.ADMIN_PASSWORD);
  const password = fromEnv ? env.ADMIN_PASSWORD : crypto.randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  // ON CONFLICT on username/email: an account with that name already exists
  // but is not superadmin — promote nothing, just report it.
  const { rowCount } = await db.query(
    `INSERT INTO users (username, password_hash, email, fullname, role_id, must_change_password, auth_source)
     VALUES ($1, $2, $3, 'Administrator', $4, TRUE, 'local')
     ON CONFLICT DO NOTHING`,
    [username, passwordHash, email, superadminRoleId]
  );
  if (!rowCount) {
    throw new Error(`Cannot create admin "${username}": that username or email (${email}) is already used by a non-superadmin account. Set ADMIN_USERNAME / ADMIN_EMAIL to other values.`);
  }
  return { created: true, username, password: fromEnv ? null : password, generated: !fromEnv };
}

export function printAdminBanner(result) {
  if (!result.created) return;
  const lines = [
    result.title || 'Initial administrator account created',
    `  username : ${result.username}`,
    result.generated
      ? `  password : ${result.password}`
      : '  password : (value of ADMIN_PASSWORD)',
    'You will be asked to change this password at first login.',
  ];
  if (result.generated) lines.push('This password is shown only once — save it now.');
  const width = Math.max(...lines.map(l => l.length)) + 2;
  const bar = '='.repeat(width + 2);
  console.log(`\n${bar}\n${lines.map(l => ` ${l.padEnd(width)} `).join('\n')}\n${bar}\n`);
}

// All seeds in one transaction. Runs after every `migrate.js up`, so new
// permissions/config keys added to this file reach existing databases too.
export async function runSeeds(db) {
  await db.query('BEGIN');
  try {
    await seedPermissionsAndRoles(db);
    await seedConfiguration(db);
    const admin = await ensureAdminUser(db);
    await db.query('COMMIT');
    return admin;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw new Error(`Seeding failed and was rolled back: ${err.message}`, { cause: err });
  }
}
