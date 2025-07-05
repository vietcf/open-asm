
import { pool } from '../../config/config.js';

const TABLE = 'configuration';

class Configuration {
  static async findAll() {
    const res = await pool.query(`SELECT * FROM ${TABLE} ORDER BY id`);
    return res.rows;
  }

  static async findByKey(key) {
    const res = await pool.query(`SELECT * FROM ${TABLE} WHERE key = $1`, [key]);
    return res.rows[0];
  }

  static async updateByKey(key, value, updatedBy = null, description = null) {
    let sql, params;
    if (description !== null && description !== undefined) {
      sql = `UPDATE ${TABLE} SET value = $1, description = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3 WHERE key = $4 RETURNING *`;
      params = [value, description, updatedBy, key];
    } else {
      sql = `UPDATE ${TABLE} SET value = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE key = $3 RETURNING *`;
      params = [value, updatedBy, key];
    }
    const res = await pool.query(sql, params);
    return res.rows[0];
  }

  static async create(key, value, description = '', updatedBy = null) {
    const res = await pool.query(
      `INSERT INTO ${TABLE} (key, value, description, updated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [key, value, description, updatedBy]
    );
    return res.rows[0];
  }

  static async deleteByKey(key) {
    await pool.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
  }
}

export default Configuration;
