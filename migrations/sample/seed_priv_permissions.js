// filepath: migrations/seed_priv_permissions.js
export default async (pool) => {
  // Lấy id hệ thống mặc định (id nhỏ nhất)
  const { rows } = await pool.query('SELECT id FROM systems ORDER BY id LIMIT 1');
  if (!rows.length) throw new Error('No system found. Please seed systems table first.');
  const systemId = rows[0].id;
  // Define privileged entities and actions
  const entities = [
    'priv_user', 'priv_role', 'priv_permission', 'system', 'unit', 'contact', 'platform', 'device_type', 'device', 'tag'
  ];
  const actions = ['view', 'create', 'edit', 'delete'];
  const permissionValues = [];
  for (const entity of entities) {
    for (const action of actions) {
      permissionValues.push(`('${entity}.${action}', '${action.charAt(0).toUpperCase() + action.slice(1)} ${entity.replace('_', ' ')}', NOW(), 'system', ${systemId})`);
    }
  }
  // Insert all permissions
  await pool.query(`
    INSERT INTO priv_permissions (name, description, updated_date, updated_by, system_id)
    VALUES
      ${permissionValues.join(',\n      ')}
    ON CONFLICT (name, system_id) DO NOTHING;
  `);
};
