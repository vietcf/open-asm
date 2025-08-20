
import { pool } from '../../config/config.js';

class PrivPermission {
  // ===== CRUD METHODS =====
  static async create({ name, description, system_id, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO priv_permissions (name, description, system_id, updated_date, updated_by)
       VALUES ($1, $2, $3, NOW(), $4) RETURNING *`,
      [name, description, system_id, updated_by]
    );
    return result.rows[0];
  }

  static async findAll(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT * FROM priv_permissions ORDER BY id LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM priv_permissions WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, system_id, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE priv_permissions SET name = $1, description = $2, system_id = $3, updated_date = NOW(), updated_by = $4 WHERE id = $5 RETURNING *`,
      [name, description, system_id, updated_by, id]
    );
    return result.rows[0];
  }

  static async remove(id, client) {
    const executor = client || pool;
    await executor.query(`DELETE FROM priv_permissions WHERE id = $1`, [id]);
  }

  // ===== FILTERED LIST & PAGINATION =====
  static async findFilteredList({ search = '', system_id = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    let query = `SELECT * FROM priv_permissions WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (search) {
      query += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
      params.push(q);
      idx++;
    }
    if (system_id) {
      query += ` AND system_id = $${idx}`;
      params.push(system_id);
      idx++;
    }
    query += ` ORDER BY id LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, offset);
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async countFiltered({ search = '', system_id = '' }) {
    const q = `%${search}%`;
    let query = `SELECT COUNT(*) FROM priv_permissions WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (search) {
      query += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
      params.push(q);
      idx++;
    }
    if (system_id) {
      query += ` AND system_id = $${idx}`;
      params.push(system_id);
      idx++;
    }
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  // ===== GET BY SYSTEM =====
  static async findBySystemId(system_id) {
    const result = await pool.query(
      `SELECT * FROM priv_permissions WHERE system_id = $1 ORDER BY name`,
      [system_id]
    );
    return result.rows;
  }

  // ===== SELECT2 AJAX SEARCH (for dropdowns) =====
  static async select2Search({ search = '', system_id = '', limit = 20 }) {
    const q = `%${search}%`;
    let query = `SELECT id, name FROM priv_permissions WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (search) {
      query += ` AND name ILIKE $${idx}`;
      params.push(q);
      idx++;
    }
    if (system_id) {
      query += ` AND system_id = $${idx}`;
      params.push(system_id);
      idx++;
    }
    query += ` ORDER BY name ASC LIMIT $${idx}`;
    params.push(limit);
    const result = await pool.query(query, params);
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  // ===== EXISTENCE CHECKER =====
  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM priv_permissions WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}

export default PrivPermission;
