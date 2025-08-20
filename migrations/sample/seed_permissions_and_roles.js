export default async (pool) => {
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
    // Bổ sung entity đặc quyền cho phân quyền tài khoản đặc quyền
    'priv_account',
    'priv_role',
    'priv_permission',
    // Thêm entity rule cho firewall
    'rule'
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

  // Seed cấu hình mặc định cho bảng configuration
  await pool.query(`
    INSERT INTO configuration (key, value) VALUES
      ('site_name', 'My System'),
      ('page_size', '10,20,50'),
      ('log_level', 'info'),
      ('log_retention_days', '30')
    ON CONFLICT (key) DO NOTHING;
  `);
};
