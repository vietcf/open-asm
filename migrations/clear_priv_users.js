// filepath: migrations/clear_priv_users.js
module.exports = async (pool) => {
  await pool.query('TRUNCATE TABLE priv_users RESTART IDENTITY CASCADE');
};
