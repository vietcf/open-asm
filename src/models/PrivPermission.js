import { pool } from '../../config/config.js';


class PrivPermission {
  // ===== CRUD METHODS =====
  static async create({ name, description, system_id, updated_by }) {
    const res = await pool.query(
      'INSERT INTO priv_permissions (name, description, system_id, updated_date, updated_by) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
      [name, description, system_id, updated_by]
    );
    return res.rows[0];
  }

  static async findAll() {
    const res = await pool.query('SELECT * FROM priv_permissions ORDER BY id');
    return res.rows;
  }

  static async findById(id) {
    const res = await pool.query('SELECT * FROM priv_permissions WHERE id = $1', [id]);
    return res.rows[0];
  }

  static async update(id, { name, description, system_id, updated_by }) {
    const res = await pool.query(
      'UPDATE priv_permissions SET name = $1, description = $2, system_id = $3, updated_date = NOW(), updated_by = $4 WHERE id = $5 RETURNING *',
      [name, description, system_id, updated_by, id]
    );
    return res.rows[0];
  }

  static async remove(id) {
    await pool.query('DELETE FROM priv_permissions WHERE id = $1', [id]);
  }

  // ===== FILTERED LIST & PAGINATION =====
  static async findFilteredList({ search = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT * FROM priv_permissions
       WHERE name ILIKE $1 OR description ILIKE $1
       ORDER BY id
       LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return res.rows;
  }

  static async countFiltered({ search = '' }) {
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT COUNT(*) FROM priv_permissions
       WHERE name ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(res.rows[0].count, 10);
  }

  // ===== SYSTEM FILTER =====
  static async findBySystemId(system_id) {
    const res = await pool.query(
      'SELECT * FROM priv_permissions WHERE system_id = $1 ORDER BY name',
      [system_id]
    );
    return res.rows;
  }

  // ===== SELECT2 AJAX SEARCH (for dropdowns) =====
  static async select2Search({ search = '', limit = 20 }) {
    let sql = 'SELECT id, name FROM priv_permissions';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  // ===== SEARCH COUNT (for compatibility) =====
  static async searchCount({ search = '' }) {
    return await this.countFiltered({ search });
  }

  // ===== SEARCH PAGE (for compatibility) =====
  static async searchPage({ search = '', page = 1, pageSize = 10 }) {
    return await this.findFilteredList({ search, page, pageSize });
  }
}

export default PrivPermission;
