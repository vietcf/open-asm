const bcrypt = require('bcrypt');

module.exports = async (pool) => {
  const hashedPassword = await bcrypt.hash('admin', 10);
  await pool.query(`
    INSERT INTO users (username, password_hash, email, fullname, role_id)
    VALUES ('admin', '${hashedPassword}', 'admin@example.com', 'Administrator', 1)
    ON CONFLICT (username) DO NOTHING;
  `);
};