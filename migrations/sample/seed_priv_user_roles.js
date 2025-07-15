// filepath: migrations/seed_priv_user_roles.js
export default async (pool) => {
  // Giả sử user_id 1,2,3 và role_id 1,2,3 đã tồn tại
  // Lấy id thực tế của user theo username
  const { rows: userRows } = await pool.query("SELECT id, username FROM priv_users WHERE username IN ('alice','bob','charlie')");
  const userMap = {};
  userRows.forEach(u => { userMap[u.username] = u.id; });

  // Lấy id thực tế của role theo tên
  const { rows: roleRows } = await pool.query("SELECT id, name FROM priv_roles WHERE name IN ('admin','manager','user')");
  const roleMap = {};
  roleRows.forEach(r => { roleMap[r.name] = r.id; });

  // Gán role cho user
  const userRoleData = [
    { username: 'alice', role: 'admin' },
    { username: 'bob', role: 'manager' },
    { username: 'charlie', role: 'user' },
  ];
  for (const row of userRoleData) {
    const user_id = userMap[row.username];
    const role_id = roleMap[row.role];
    if (user_id && role_id) {
      await pool.query(
        `INSERT INTO priv_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user_id, role_id]
      );
    }
  }
};
