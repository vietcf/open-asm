
import { pool } from '../../config/config.js';


class DeviceType {
  static async create({ name, description }) {
    const sql = 'INSERT INTO device_types (name, description) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(sql, [name, description]);
    return result.rows[0];
  }

  static async findAll() {
    const sql = 'SELECT * FROM device_types ORDER BY name';
    const result = await pool.query(sql);
    return result.rows;
  }

  static async findById(id) {
    const sql = 'SELECT * FROM device_types WHERE id = $1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  }

  static async update(id, { name, description }) {
    const sql = 'UPDATE device_types SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';
    const result = await pool.query(sql, [name, description, id]);
    return result.rows[0];
  }

  static async remove(id) {
    await pool.query('DELETE FROM device_types WHERE id = $1', [id]);
  }

  static async select2Search(search = '', limit = 20) {
    let sql = 'SELECT id, name FROM device_types';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY id LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  static async countFiltered(search = '') {
    if (search) {
      const q = `%${search}%`;
      const result = await pool.query('SELECT COUNT(*) FROM device_types WHERE name ILIKE $1 OR description ILIKE $1', [q]);
      return parseInt(result.rows[0].count, 10);
    } else {
      const result = await pool.query('SELECT COUNT(*) FROM device_types');
      return parseInt(result.rows[0].count, 10);
    }
  }

  static async findFilteredPage({ search = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    if (search) {
      const q = `%${search}%`;
      const result = await pool.query('SELECT * FROM device_types WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3', [q, pageSize, offset]);
      return result.rows;
    } else {
      const result = await pool.query('SELECT * FROM device_types ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset]);
      return result.rows;
    }
  }
}

export default DeviceType;
