// filepath: migrations/clear_priv_user_roles.js
module.exports = async (pool) => {
  await pool.query('TRUNCATE TABLE priv_user_roles RESTART IDENTITY CASCADE');
};
