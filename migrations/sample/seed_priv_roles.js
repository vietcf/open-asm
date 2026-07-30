// filepath: migrations/seed_priv_roles.js
export default async (pool) => {
  // Insert roles in order: admin, manager, user (ID will auto-increment)
  await pool.query(`
    INSERT INTO priv_roles (name, description, created_at, updated_date, updated_by)
    VALUES
      ('admin', 'Quản trị viên', NOW(), NOW(), 'system'),
      ('manager', 'Quản lý', NOW(), NOW(), 'system'),
      ('user', 'Người dùng', NOW(), NOW(), 'system')
    ON CONFLICT (name, system_id) DO NOTHING;
  `);
  // Note: If you need to guarantee IDs, clear the table before seeding.
};
