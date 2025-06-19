// filepath: migrations/seed_priv_users.js
module.exports = async (pool) => {
  // Seed priv_users
  await pool.query(`
    INSERT INTO priv_users (username, description, organize_id, role_id, created_at, updated_date, updated_by, account_type, manage_type, app_url)
    VALUES
      ('alice', 'Quản trị viên hệ thống', 1, 1, NOW(), NOW(), 'system', 'OS', 'Manual', NULL),
      ('bob', 'Quản lý vận hành', 1, 2, NOW(), NOW(), 'system', 'APP', 'Automatic', 'https://app.example.com'),
      ('charlie', 'Người dùng thông thường', 2, 3, NOW(), NOW(), 'system', 'DB', 'Manual', NULL)
    ON CONFLICT (username) DO NOTHING;
  `);

  // Seed priv_user_contacts (giả sử user_id 1,2,3 và contact_id 1,2,3 đã tồn tại)
  await pool.query(`
    INSERT INTO priv_user_contacts (user_id, contact_id)
    VALUES
      (1, 1),
      (1, 2),
      (2, 3)
    ON CONFLICT DO NOTHING;
  `);
};
