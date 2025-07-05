// filepath: migrations/seed_priv_users.js
module.exports = async (pool) => {
  // Seed priv_users
  // Lấy id các đơn vị (unit) theo code
  const { rows: unitRows } = await pool.query("SELECT id, code FROM units WHERE code IN ('IT','HR','FIN')");
  const unitMap = {};
  unitRows.forEach(u => { unitMap[u.code] = u.id; });

  // Lấy id các role theo tên
  const { rows: roleRows } = await pool.query("SELECT id, name FROM priv_roles WHERE name IN ('admin','manager','user')");
  const roleMap = {};
  roleRows.forEach(r => { roleMap[r.name] = r.id; });

  // Seed priv_users với id thực tế
  const usersData = [
    { username: 'alice', description: 'Quản trị viên hệ thống', organize_code: 'IT', role_name: 'admin', account_type: 'OS', manage_type: 'Manual', app_url: null },
    { username: 'bob', description: 'Quản lý vận hành', organize_code: 'IT', role_name: 'manager', account_type: 'APP', manage_type: 'Automatic', app_url: 'https://app.example.com' },
    { username: 'charlie', description: 'Người dùng thông thường', organize_code: 'HR', role_name: 'user', account_type: 'DB', manage_type: 'Manual', app_url: null },
  ];
  for (const user of usersData) {
    const organize_id = unitMap[user.organize_code];
    const role_id = roleMap[user.role_name];
    if (organize_id && role_id) {
      await pool.query(
        `INSERT INTO priv_users (username, description, organize_id, role_id, created_at, updated_date, updated_by, account_type, manage_type, app_url)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), 'system', $5, $6, $7)
         ON CONFLICT (username) DO NOTHING;`,
        [user.username, user.description, organize_id, role_id, user.account_type, user.manage_type, user.app_url]
      );
    }
  }

  // Lấy id thực tế của user theo username
  const { rows: userRows } = await pool.query("SELECT id, username FROM priv_users WHERE username IN ('alice','bob','charlie')");
  const userMap = {};
  userRows.forEach(u => { userMap[u.username] = u.id; });

  // Lấy id thực tế của contact theo tên (giả sử tên là duy nhất)
  const { rows: contactRows } = await pool.query("SELECT id, name FROM contacts WHERE name IN ('Nguyen Van A','Tran Thi B','Le Van C')");
  const contactMap = {};
  contactRows.forEach(c => { contactMap[c.name] = c.id; });

  // Gán contact cho user (ví dụ: alice - A,B; bob - C)
  const userContactData = [
    { username: 'alice', contacts: ['Nguyen Van A', 'Tran Thi B'] },
    { username: 'bob', contacts: ['Le Van C'] }
  ];
  for (const row of userContactData) {
    const user_id = userMap[row.username];
    if (user_id) {
      for (const contactName of row.contacts) {
        const contact_id = contactMap[contactName];
        if (contact_id) {
          await pool.query(
            `INSERT INTO priv_user_contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [user_id, contact_id]
          );
        }
      }
    }
  }
};
