
import { pool } from '../../../config/config.js';

const Role = {
  findAll: async () => {
    const sql = 'SELECT id, name, description FROM roles ORDER BY id';
    const result = await pool.query(sql);
    return result.rows;
  },
  findById: async (id) => {
    const sql = 'SELECT id, name, description FROM roles WHERE id = $1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  },
  create: async ({ name, description }) => {
    const sql = 'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(sql, [name, description]);
    return result.rows[0];
  },
  update: async (id, { name, description }) => {
    const sql = 'UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING *';
    const result = await pool.query(sql, [name, description, id]);
    return result.rows[0];
  },
  delete: async (id) => {
    await pool.query('DELETE FROM roles WHERE id = $1', [id]);
  },
  getPermissions: async (roleId) => {
    const sql = `SELECT p.id, p.name, p.description FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = $1 ORDER BY p.name`;
    const result = await pool.query(sql, [roleId]);
    return result.rows;
  },
  updatePermissions: async (roleId, permissionIds) => {
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    for (const pid of permissionIds) {
      await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, pid]);
    }
  },
  // Create a role and assign permissions in a transaction-aware way
  createWithPermissions: async ({ name, description, permissions }, client) => {
    // Insert role
    const insertRoleResult = await client.query('INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
    const newRole = insertRoleResult.rows[0];
    // Assign permissions
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [newRole.id]);
    for (const pid of permissions) {
      await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [newRole.id, pid]);
    }
    return newRole;
  },
  
  /**
   * Count roles with optional filters (for pagination/search)
   * @param {Object} filters
   * @returns {Promise<number>}
   */
  countFiltered: async (filters = {}) => {
    let whereClause = '';
    let queryParams = [];
    let paramCount = 0;
    
    if (filters.search) {
      whereClause = `WHERE name ILIKE $${++paramCount} OR description ILIKE $${++paramCount}`;
      const searchPattern = `%${filters.search}%`;
      queryParams = [searchPattern, searchPattern];
    }
    
    const sql = `SELECT COUNT(*) FROM roles ${whereClause}`;
    const result = await pool.query(sql, queryParams);
    return parseInt(result.rows[0].count, 10);
  },
  
  /**
   * Get a filtered page of roles (for pagination/search)
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.pageSize
   * @returns {Promise<Array>}
   */
  findFilteredList: async ({ page, pageSize, ...filters }) => {
    let whereClause = '';
    let queryParams = [];
    let paramCount = 0;
    
    if (filters && typeof filters['search'] === 'string' && filters['search'].trim()) {
      whereClause = `WHERE name ILIKE $${++paramCount} OR description ILIKE $${++paramCount}`;
      const searchPattern = `%${filters['search']}%`;
      queryParams = [searchPattern, searchPattern];
    }
    
    const offset = (page - 1) * pageSize;
    const sql = `SELECT id, name, description FROM roles ${whereClause} ORDER BY name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    const result = await pool.query(sql, [...queryParams, pageSize, offset]);
    return result.rows;
  }
};

export default Role;
