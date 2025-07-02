// filepath: migrations/create_priv_role_permissions_table.js
module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS priv_role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INT REFERENCES priv_roles(id) ON DELETE CASCADE,
      permission_id INT REFERENCES priv_permissions(id) ON DELETE CASCADE
    );
  `);
};
