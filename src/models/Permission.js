const { pool } = require('../../config/config');

const Permission = {
  findAll: async () => {
    const sql = 'SELECT id, name, description FROM permissions ORDER BY name';
    const result = await pool.query(sql);
    return result.rows;
  },
  findById: async (id) => {
    const sql = 'SELECT id, name, description FROM permissions WHERE id = $1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  },
  create: async ({ name, description }) => {
    const sql = 'INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(sql, [name, description]);
    return result.rows[0];
  },
  update: async (id, { description }) => {
    const sql = 'UPDATE permissions SET description = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(sql, [description, id]);
    return result.rows[0];
  },
  delete: async (id) => {
    await pool.query('DELETE FROM permissions WHERE id = $1', [id]);
  },
  findByRoleId: async (roleId) => {
    const sql = `
      SELECT p.id, p.name, p.description
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      ORDER BY p.name
    `;
    const result = await pool.query(sql, [roleId]);
    return result.rows;
  }
};

module.exports = Permission;
