// filepath: migrations/create_priv_user_roles_table.js
module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS priv_user_roles (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      role_id INT REFERENCES priv_roles(id) ON DELETE CASCADE
    );
  `);
};
