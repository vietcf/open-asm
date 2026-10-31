const { pool } = require('../../config/config');
const AccessControl = require('accesscontrol');

async function buildAccessControl() {
  const { rows } = await pool.query(`
    SELECT r.name as role, p.name as permission
    FROM roles r
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
  `);

  // Convert rows into an accesscontrol grants object
  // Example: { admin: { user: { 'create:any': ['*'], ... } }, ... }
  const grants = {};
  rows.forEach(row => {
    // Trim whitespace from permission string before splitting
    const permission = row.permission.trim();
    const [resourceRaw, actionRaw] = permission.split('.');
    const resource = resourceRaw.trim();
    const action = actionRaw.trim();
    if (!grants[row.role]) grants[row.role] = {};
    if (!grants[row.role][resource]) grants[row.role][resource] = {};
    grants[row.role][resource][`${action}:any`] = ['*'];
  });

  return new AccessControl(grants);
}

module.exports = buildAccessControl;
