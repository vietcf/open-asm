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

  static async update(id, updates) {
    // Handle both legacy usage (full object) and new API usage (partial updates)
    const validFields = ['name', 'description'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic SQL for partial updates
    for (const [key, value] of Object.entries(updates)) {
      if (validFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields provided for update');
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add id parameter
    values.push(id);
    const sql = `UPDATE device_types SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(sql, values);
    return result.rows[0];
  }

  static async checkNameExists(name, excludeId = null) {
    let sql = 'SELECT id FROM device_types WHERE LOWER(name) = LOWER($1)';
    const params = [name];
    
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    
    const result = await pool.query(sql, params);
    return result.rows.length > 0;
  }

  // Find device types by exact name match
  static async findByNameExact(name) {
    const sql = 'SELECT * FROM device_types WHERE LOWER(name) = LOWER($1) ORDER BY id';
    const result = await pool.query(sql, [name]);
    return result.rows;
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
