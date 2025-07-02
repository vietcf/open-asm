// filepath: migrations/seed_priv_user_roles.js
module.exports = async (pool) => {
  // Giả sử user_id 1,2,3 và role_id 1,2,3 đã tồn tại
  await pool.query(`
    INSERT INTO priv_user_roles (user_id, role_id)
    VALUES
      (1, 1),
      (2, 2),
      (3, 3)
    ON CONFLICT DO NOTHING;
  `);
};
