const { pool } = require('../../config/config');

const User = {
  findByUsername: async (username) => {
    const sql = `SELECT users.*, roles.name AS role_name FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE users.username = $1 LIMIT 1`;
    const result = await pool.query(sql, [username]);
    return result.rows[0];
  },
  findAll: async () => {
    const sql = 'SELECT * FROM users ORDER BY id';
    const result = await pool.query(sql);
    return result.rows;
  },
  create: async ({ username, email, fullname, role, passwordHash, require_twofa, must_change_password }) => {
    const sql = 'INSERT INTO users (username, email, fullname, role_id, password_hash, require_twofa, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *';
    const result = await pool.query(sql, [username, email, fullname, role, passwordHash, require_twofa, must_change_password !== undefined ? must_change_password : true]);
    return result.rows[0];
  },
  update: async (id, { username, email, fullname, role, require_twofa, must_change_password, passwordHash }) => {
    let sql, params;
    if (passwordHash) {
      sql = 'UPDATE users SET username = $1, email = $2, fullname = $3, role_id = $4, require_twofa = $5, must_change_password = $6, password_hash = $7 WHERE id = $8 RETURNING *';
      params = [username, email, fullname, role, require_twofa, must_change_password, passwordHash, id];
    } else {
      sql = 'UPDATE users SET username = $1, email = $2, fullname = $3, role_id = $4, require_twofa = $5, must_change_password = $6 WHERE id = $7 RETURNING *';
      params = [username, email, fullname, role, require_twofa, must_change_password, id];
    }
    const result = await pool.query(sql, params);
    return result.rows[0];
  },
  delete: async (id) => {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },
  countAll: async () => {
    const sql = 'SELECT COUNT(*) FROM users';
    const result = await pool.query(sql);
    return parseInt(result.rows[0].count, 10);
  },
  findPage: async (page, pageSize) => {
    const offset = (page - 1) * pageSize;
    // Join with roles table to get role name
    const sql = `SELECT users.*, roles.name AS role_name FROM users LEFT JOIN roles ON users.role_id = roles.id ORDER BY users.id LIMIT $1 OFFSET $2`;
    const result = await pool.query(sql, [pageSize, offset]);
    return result.rows;
  },
  findById: async (id) => {
    const sql = 'SELECT * FROM users WHERE id = $1 LIMIT 1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  },
  updateTwoFA: async (id, secret, enabled) => {
    const sql = 'UPDATE users SET twofa_secret = $1, twofa_enabled = $2 WHERE id = $3';
    await pool.query(sql, [secret, enabled, id]);
  },
  updateTwofaDeadline: async (id, deadline) => {
    const sql = 'UPDATE users SET twofa_setup_deadline = $1 WHERE id = $2';
    await pool.query(sql, [deadline, id]);
  },
  updatePassword: async (id, newHash) => {
    const sql = 'UPDATE users SET password_hash = $1 WHERE id = $2';
    await pool.query(sql, [newHash, id]);
  },
  updateMustChangePassword: async (id, value) => {
    const sql = 'UPDATE users SET must_change_password = $1 WHERE id = $2';
    await pool.query(sql, [value, id]);
  },
};

module.exports = User;
