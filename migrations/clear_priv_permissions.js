// filepath: migrations/clear_priv_permissions.js
module.exports = async (pool) => {
  await pool.query('TRUNCATE TABLE priv_permissions RESTART IDENTITY CASCADE');
};
