// filepath: migrations/seed_priv_role_permissions.js
export default async (pool) => {
  // Get all roles and permissions
  const { rows: roles } = await pool.query('SELECT id, name FROM priv_roles');
  const { rows: permissions } = await pool.query('SELECT id, name FROM priv_permissions');
  const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
  const permMap = Object.fromEntries(permissions.map(p => [p.name, p.id]));

  // Assign all permissions to admin
  for (const permId of Object.values(permMap)) {
    await pool.query(
      'INSERT INTO priv_role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleMap['admin'], permId]
    );
  }
  // Assign only view and edit permissions to manager
  for (const [permName, permId] of Object.entries(permMap)) {
    if (permName.endsWith('.view') || permName.endsWith('.edit')) {
      await pool.query(
        'INSERT INTO priv_role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['manager'], permId]
      );
    }
  }
  // Assign only view permissions to user
  for (const [permName, permId] of Object.entries(permMap)) {
    if (permName.endsWith('.view')) {
      await pool.query(
        'INSERT INTO priv_role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['user'], permId]
      );
    }
  }
};
