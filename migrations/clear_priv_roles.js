// filepath: migrations/clear_priv_roles.js
module.exports = async (pool) => {
  await pool.query('TRUNCATE TABLE priv_roles RESTART IDENTITY CASCADE');
};
