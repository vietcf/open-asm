import { pool } from '../../config/config.js';

/**
 * Permission model for PostgreSQL (ES6 class style)
 * Provides static methods for CRUD and role-based permission queries.
 */
class Permission {
  /**
   * Get all permissions
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const sql = 'SELECT id, name, description FROM permissions ORDER BY name';
    const result = await pool.query(sql);
    return result.rows;
  }

  /**
   * Find permission by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = 'SELECT id, name, description FROM permissions WHERE id = $1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Create a new permission
   * @param {Object} param0
   * @param {string} param0.name
   * @param {string} param0.description
   * @returns {Promise<Object>}
   */
  static async create({ name, description }) {
    const sql = 'INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(sql, [name, description]);
    return result.rows[0];
  }

  /**
   * Update a permission's description
   * @param {number} id
   * @param {Object} param1
   * @param {string} param1.description
   * @returns {Promise<Object>}
   */
  static async update(id, { description }) {
    const sql = 'UPDATE permissions SET description = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(sql, [description, id]);
    return result.rows[0];
  }

  /**
   * Delete a permission by ID
   * @param {number} id
   * @returns {Promise<void>}
   */
  static async delete(id) {
    await pool.query('DELETE FROM permissions WHERE id = $1', [id]);
  }

  /**
   * Find permissions by role ID
   * @param {number} roleId
   * @returns {Promise<Array>}
   */
  static async findByRoleId(roleId) {
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

  /**
   * Count permissions with optional filters (for pagination/search)
   * @param {Object} filters
   * @returns {Promise<number>}
   */
  static async countFiltered(filters = {}) {
    // Hiện tại chỉ hỗ trợ đếm tất cả, có thể mở rộng filter sau
    const sql = 'SELECT COUNT(*) FROM permissions';
    const result = await pool.query(sql);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get a filtered page of permissions (for pagination/search)
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.pageSize
   * @returns {Promise<Array>}
   */
  static async findFilteredList({ page, pageSize, ...filters }) {
    // Hiện tại chỉ hỗ trợ phân trang, có thể mở rộng filter sau
    const offset = (page - 1) * pageSize;
    const sql = `SELECT id, name, description FROM permissions ORDER BY name LIMIT $1 OFFSET $2`;
    const result = await pool.query(sql, [pageSize, offset]);
    return result.rows;
  }
}

export default Permission;
