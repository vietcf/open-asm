// migrations/init_data.js
// Khởi tạo dữ liệu mẫu cho user, permission, role, configure
import { pool } from '../config/config.js';
import bcrypt from 'bcrypt';

async function seedUsers(pool) {
  // Lấy id của role superadmin
  const { rows } = await pool.query(`SELECT id FROM roles WHERE name = 'superadmin' LIMIT 1`);
  if (!rows.length) throw new Error('Role superadmin not found');
  const superadminRoleId = rows[0].id;
  // Seed admin user
  const hashedPassword = await bcrypt.hash('admin', 10);
  await pool.query(`
    INSERT INTO users (username, password_hash, email, fullname, role_id)
    VALUES ('admin', '${hashedPassword}', 'admin@example.com', 'Administrator', $1)
    ON CONFLICT (username) DO NOTHING;
  `, [superadminRoleId]);
}

async function seedPermissionsAndRoles(pool) {
  // Seed roles
  await pool.query(`
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
    'priv_account', 'priv_role', 'priv_permission', 'rule'
  ];
  const actions = ['create', 'read', 'update', 'delete'];
  const permissionValues = [];
  for (const entity of entities) {
    for (const action of actions) {
      permissionValues.push(`('${entity}.${action}', '${action.charAt(0).toUpperCase() + action.slice(1)} ${entity.replace('_', ' ')}')`);
    }
  }
  await pool.query(`
    INSERT INTO permissions (name, description) VALUES
      ${permissionValues.join(',\n      ')}
    ON CONFLICT (name) DO NOTHING;
  `);

  // Map role to permission
  // Get role ids
  const { rows: roleRows } = await pool.query('SELECT id, name FROM roles');
  const { rows: permRows } = await pool.query('SELECT id, name FROM permissions');
  const roleMap = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
  const permMap = Object.fromEntries(permRows.map(p => [p.name, p.id]));

  // Superadmin: all permissions
  for (const permId of Object.values(permMap)) {
    await pool.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleMap['superadmin'], permId]
    );
  }
  // Admin: all except user, role, permission
  for (const permName of Object.keys(permMap)) {
    if (!permName.startsWith('user.') && !permName.startsWith('role.') && !permName.startsWith('permission.')) {
      await pool.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['admin'], permMap[permName]]
      );
    }
  }
  // Viewer: chỉ quyền đọc, trừ user, role, permission
  for (const permName of Object.keys(permMap)) {
    if (permName.endsWith('.read') && !permName.startsWith('user.') && !permName.startsWith('role.') && !permName.startsWith('permission.')) {
      await pool.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['viewer'], permMap[permName]]
      );
    }
  }
}

async function seedConfiguration(pool) {
  // Thêm cấu hình mặc định nếu cần
  try {
    await pool.query(`INSERT INTO configuration (key, value) VALUES ('site_name', 'VCB ASM') ON CONFLICT (key) DO NOTHING;`);
    // await pool.query(`INSERT INTO configuration (key, value) VALUES ('default_language', 'en') ON CONFLICT (key) DO NOTHING;`);
    await pool.query(`INSERT INTO configuration (key, value) VALUES ('page_size', '10,20,50') ON CONFLICT (key) DO NOTHING;`);
    await pool.query(`INSERT INTO configuration (key, value) VALUES ('log_level', 'info') ON CONFLICT (key) DO NOTHING;`);
    await pool.query(`INSERT INTO configuration (key, value) VALUES ('log_retention_days', '30') ON CONFLICT (key) DO NOTHING;`);
    console.log('Default configuration seeded.');
  } catch (err) {
    console.error('Seed configuration failed:', err);
  }
}

async function initData() {
  try {
    await seedPermissionsAndRoles(pool); // Seed roles/permissions trước
    await seedUsers(pool); // Sau đó mới seed user admin
    await seedConfiguration(pool);
    console.log('Initial data seeded for users, permissions, roles, configuration.');
  } catch (err) {
    console.error('Seeding initial data failed:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

initData();
