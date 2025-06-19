// filepath: migrations/clear_priv_role_permissions.js
module.exports = async (pool) => {
  await pool.query('TRUNCATE TABLE priv_role_permissions RESTART IDENTITY CASCADE');
};
