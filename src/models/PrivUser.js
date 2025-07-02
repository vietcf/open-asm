// filepath: src/models/PrivUser.js
const { pool } = require('../../config/config');

class PrivUser {
  // Get all privileged users (no pagination, no search)
  static async findAll() {
    const res = await pool.query('SELECT * FROM priv_users ORDER BY id');
    return res.rows;
  }
  // Find privileged user by id
  static async findById(id) {
    const res = await pool.query('SELECT * FROM priv_users WHERE id = $1', [id]);
    return res.rows[0];
  }
  // Create a new privileged user
  static async create({ username, description, password }) {
    // Note: password should be hashed in the controller
    const res = await pool.query(
      'INSERT INTO priv_users (username, description, created_at, updated_date, updated_by) VALUES ($1, $2, NOW(), NOW(), $3) RETURNING *',
      [username, description, username]
    );
    return res.rows[0];
  }
  // Update a privileged user
  static async update(id, { username, description }) {
    const res = await pool.query(
      'UPDATE priv_users SET username = $1, description = $2, updated_date = NOW() WHERE id = $3 RETURNING *',
      [username, description, id]
    );
    return res.rows[0];
  }
  // Delete a privileged user
  static async delete(id) {
    await pool.query('DELETE FROM priv_users WHERE id = $1', [id]);
  }
  // Count total privileged users matching the search keyword (username or description)
  static async searchCount(search) {
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT COUNT(*) FROM priv_users
       WHERE username ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(res.rows[0].count, 10);
  }
  // Fetch a page of privileged accounts with all associations and audit fields
  static async searchPageWithDetails(search, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    // Get main account rows
    const res = await pool.query(
      `SELECT * FROM priv_users
       WHERE username ILIKE $1 OR description ILIKE $1
       ORDER BY id
       LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    const users = res.rows;
    if (!users.length) return [];
    // Collect all user ids
    const userIds = users.map(u => u.id);
    // Fetch contacts
    const contactRows = await pool.query(
      `SELECT puc.user_id, c.id, c.name, c.email FROM priv_user_contacts puc JOIN contacts c ON puc.contact_id = c.id WHERE puc.user_id = ANY($1)`,
      [userIds]
    );
    // Fetch systems
    const systemRows = await pool.query(
      `SELECT pus.user_id, s.id, s.name FROM priv_user_systems pus JOIN systems s ON pus.system_id = s.id WHERE pus.user_id = ANY($1)`,
      [userIds]
    );
    // Fetch servers
    const serverRows = await pool.query(
      `SELECT pus.user_id, s.id, s.name FROM priv_user_servers pus JOIN servers s ON pus.server_id = s.id WHERE pus.user_id = ANY($1)`,
      [userIds]
    );
    // Fetch organize units
    const organizeIds = [...new Set(users.map(u => u.organize_id).filter(Boolean))];
    let organizeMap = {};
    if (organizeIds.length) {
      const orgRows = await pool.query('SELECT id, name FROM units WHERE id = ANY($1)', [organizeIds]);
      organizeMap = Object.fromEntries(orgRows.rows.map(r => [r.id, r]));
    }
    // Fetch roles
    const roleIds = [...new Set(users.map(u => u.role_id).filter(Boolean))];
    let roleMap = {};
    if (roleIds.length) {
      const roleRows = await pool.query('SELECT id, name FROM priv_roles WHERE id = ANY($1)', [roleIds]);
      roleMap = Object.fromEntries(roleRows.rows.map(r => [r.id, r]));
    }
    // Attach associations
    for (const user of users) {
      user.contacts = contactRows.rows.filter(r => r.user_id === user.id).map(r => ({ id: r.id, name: r.name, email: r.email }));
      user.systems = systemRows.rows.filter(r => r.user_id === user.id).map(r => ({ id: r.id, name: r.name }));
      user.servers = serverRows.rows.filter(r => r.user_id === user.id).map(r => ({ id: r.id, name: r.name }));
      user.organize = user.organize_id ? organizeMap[user.organize_id] || null : null;
      user.role = user.role_id ? roleMap[user.role_id] || null : null;
    }
    return users;
  }
  // Fetch a single privileged account with all associations (for edit)
  static async findByIdWithDetails(id) {
    const res = await pool.query('SELECT * FROM priv_users WHERE id = $1', [id]);
    if (!res.rows.length) return null;
    const user = res.rows[0];
    // Fetch contacts
    const contactRows = await pool.query(
      `SELECT puc.user_id, c.id, c.name, c.email FROM priv_user_contacts puc JOIN contacts c ON puc.contact_id = c.id WHERE puc.user_id = $1`,
      [user.id]
    );
    // Fetch systems
    const systemRows = await pool.query(
      `SELECT pus.user_id, s.id, s.name FROM priv_user_systems pus JOIN systems s ON pus.system_id = s.id WHERE pus.user_id = $1`,
      [user.id]
    );
    // Fetch servers
    const serverRows = await pool.query(
      `SELECT pus.user_id, s.id, s.name FROM priv_user_servers pus JOIN servers s ON pus.server_id = s.id WHERE pus.user_id = $1`,
      [user.id]
    );
    // Organize unit
    let organize = null;
    if (user.organize_id) {
      const orgRows = await pool.query('SELECT id, name FROM units WHERE id = $1', [user.organize_id]);
      organize = orgRows.rows[0] || null;
    }
    // Role
    let role = null;
    if (user.role_id) {
      const roleRows = await pool.query('SELECT id, name FROM priv_roles WHERE id = $1', [user.role_id]);
      role = roleRows.rows[0] || null;
    }
    user.contacts = contactRows.rows.map(r => ({ id: r.id, name: r.name, email: r.email }));
    user.systems = systemRows.rows.map(r => ({ id: r.id, name: r.name }));
    user.servers = serverRows.rows.map(r => ({ id: r.id, name: r.name }));
    user.organize = organize;
    user.role = role;
    return user;
  }
}

module.exports = PrivUser;
