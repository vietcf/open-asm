const { pool } = require('../../config/config');

const TABLE = 'configuration';

const Configuration = {
  async findAll() {
    const res = await pool.query(`SELECT * FROM ${TABLE} ORDER BY id`);
    return res.rows;
  },
  async findByKey(key) {
    const res = await pool.query(`SELECT * FROM ${TABLE} WHERE key = $1`, [key]);
    return res.rows[0];
  },
  async updateByKey(key, value, updated_by = null, description = null) {
    // description is optional
    let sql, params;
    if (description !== null && description !== undefined) {
      sql = `UPDATE ${TABLE} SET value = $1, description = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3 WHERE key = $4 RETURNING *`;
      params = [value, description, updated_by, key];
    } else {
      sql = `UPDATE ${TABLE} SET value = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE key = $3 RETURNING *`;
      params = [value, updated_by, key];
    }
    const res = await pool.query(sql, params);
    return res.rows[0];
  },
  async create(key, value, description = '', updated_by = null) {
    const res = await pool.query(
      `INSERT INTO ${TABLE} (key, value, description, updated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [key, value, description, updated_by]
    );
    return res.rows[0];
  },
  async deleteByKey(key) {
    await pool.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
  }
};

module.exports = Configuration;
