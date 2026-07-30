import { pool } from '../../config/config.js';

const TABLE = 'configuration';


class Configuration {
  // ===== CRUD METHODS =====
  static async create({ key, value, description = '', updatedBy = null }) {
    const res = await pool.query(
      `INSERT INTO ${TABLE} (key, value, description, updated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [key, value, description, updatedBy]
    );
    return res.rows[0];
  }

  static async findAll() {
    const res = await pool.query(`SELECT * FROM ${TABLE} ORDER BY id`);
    return res.rows;
  }

  static async findById(key) {
    const res = await pool.query(`SELECT * FROM ${TABLE} WHERE key = $1`, [key]);
    return res.rows[0];
  }

  static async update(key, { value, updatedBy = null, description = null }) {
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

  static async remove(key) {
    await pool.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
  }

  // ===== FILTERED LIST & PAGINATION =====
  static async findFilteredList({ search = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT * FROM ${TABLE}
       WHERE key ILIKE $1 OR value ILIKE $1 OR description ILIKE $1
       ORDER BY id
       LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return res.rows;
  }

  static async countFiltered({ search = '' }) {
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT COUNT(*) FROM ${TABLE}
       WHERE key ILIKE $1 OR value ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(res.rows[0].count, 10);
  }

  // ===== SELECT2 AJAX SEARCH (for dropdowns) =====
  static async select2Search({ search = '', limit = 20 }) {
    let sql = `SELECT key, value FROM ${TABLE}`;
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(key) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY key LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.key, text: row.key }));
  }

  // ===== FIND BY KEY (for compatibility) =====
  static async findByKey(key) {
    return await this.findById(key);
  }
}

export default Configuration;
