const { pool } = require('../../config/config');

const DeviceType = {
  findAll: async () => {
    const sql = 'SELECT * FROM device_types ORDER BY name';
    const result = await pool.query(sql);
    return result.rows;
  },
  findById: async (id) => {
    const sql = 'SELECT * FROM device_types WHERE id = $1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  },
  create: async ({ name, description }) => {
    const sql = 'INSERT INTO device_types (name, description) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(sql, [name, description]);
    return result.rows[0];
  },
  update: async (id, { name, description }) => {
    const sql = 'UPDATE device_types SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';
    const result = await pool.query(sql, [name, description, id]);
    return result.rows[0];
  },
  delete: async (id) => {
    await pool.query('DELETE FROM device_types WHERE id = $1', [id]);
  },
  searchForSelect2: async (search) => {
    let sql = 'SELECT id, name FROM device_types';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY id LIMIT 20';
    const result = await pool.query(sql, params);
    // select2 expects [{id, text}]
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }
};

module.exports = DeviceType;
