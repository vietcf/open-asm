// filepath: src/models/PrivRole.js
const { pool } = require('../../config/config');

class PrivRole {
  static async findAll() {
    const res = await pool.query(`
      SELECT r.*, s.id as system_id, s.name as system_name
      FROM priv_roles r
      LEFT JOIN systems s ON r.system_id = s.id
      ORDER BY r.id
    `);
    return res.rows.map(row => ({
      ...row,
      system: row.system_id ? { id: row.system_id, name: row.system_name } : null
    }));
  }
  static async findById(id) {
    const res = await pool.query(`
      SELECT r.*, s.id as system_id, s.name as system_name
      FROM priv_roles r
      LEFT JOIN systems s ON r.system_id = s.id
      WHERE r.id = $1
    `, [id]);
    const row = res.rows[0];
    if (!row) return null;
    return {
      ...row,
      system: row.system_id ? { id: row.system_id, name: row.system_name } : null
    };
  }
  static async create({ name, description, system_id, updated_by }) {
    try {
      const res = await pool.query(
        'INSERT INTO priv_roles (name, description, system_id, updated_date, updated_by) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
        [name, description, system_id, updated_by]
      );
      return res.rows[0];
    } catch (err) {
      // Unique constraint violation for (name, system_id)
      if (err.code === '23505') {
        throw new Error('A role with this name already exists for the selected system. Please choose a different name or system.');
      }
      throw err;
    }
  }
  static async update(id, { name, description, system_id, updated_by }) {
    const res = await pool.query(
      'UPDATE priv_roles SET name = $1, description = $2, system_id = $3, updated_date = NOW(), updated_by = $4 WHERE id = $5 RETURNING *',
      [name, description, system_id, updated_by, id]
    );
    return res.rows[0];
  }
  static async delete(id) {
    await pool.query('DELETE FROM priv_roles WHERE id = $1', [id]);
  }
  // Search roles by name or description, with pagination
  static async searchPage(search, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const res = await pool.query(`
      SELECT r.*, s.id as system_id, s.name as system_name
      FROM priv_roles r
      LEFT JOIN systems s ON r.system_id = s.id
      WHERE r.name ILIKE $1 OR r.description ILIKE $1
      ORDER BY r.id
      LIMIT $2 OFFSET $3
    `, [q, pageSize, offset]);
    return res.rows.map(row => ({
      ...row,
      system: row.system_id ? { id: row.system_id, name: row.system_name } : null
    }));
  }
  // Count total roles matching the search keyword (name or description)
  static async searchCount(search) {
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT COUNT(*) FROM priv_roles
       WHERE name ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(res.rows[0].count, 10);
  }
  // Search roles for select2 (by name or description, no pagination, limit 30)
  static async apiSystemSearch(search, system_ids) {
    const q = `%${search}%`;
    // Lọc bỏ các giá trị rỗng/thừa
    if (Array.isArray(system_ids)) {
      system_ids = system_ids.filter(x => x !== undefined && x !== null && x !== '');
    }
    let sql = `SELECT id, name FROM priv_roles WHERE (name ILIKE $1 OR description ILIKE $1)`;
    let params = [q];
    if (system_ids && Array.isArray(system_ids) && system_ids.length > 0) {
      sql += ' AND system_id = ANY($2)';
      params.push(system_ids);
    } else {
      // Nếu không có system hợp lệ, trả về []
      return [];
    }
    sql += ' ORDER BY name ASC LIMIT 30';
    const res = await pool.query(sql, params);
    return res.rows;
  }
  // Get all permissions for a role
  static async getPermissions(roleId) {
    const res = await pool.query(
      `SELECT p.* FROM priv_role_permissions rp JOIN priv_permissions p ON rp.permission_id = p.id WHERE rp.role_id = $1 ORDER BY p.name`,
      [roleId]
    );
    return res.rows;
  }

  // Update permissions for a role (delete old, insert new)
  static async updatePermissions(roleId, permissionIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM priv_role_permissions WHERE role_id = $1', [roleId]);
      for (const permId of permissionIds) {
        await client.query('INSERT INTO priv_role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permId]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  // Find roles by system_ids (array)
  static async findBySystemIds(system_ids) {
    if (!Array.isArray(system_ids) || !system_ids.length) return [];
    // Lọc bỏ các giá trị rỗng/thừa và ép kiểu về số nguyên
    system_ids = system_ids
      .filter(x => x !== undefined && x !== null && x !== '')
      .map(x => Number(x))
      .filter(x => !isNaN(x));
    if (!system_ids.length) return [];
    const res = await pool.query(
      'SELECT id, name FROM priv_roles WHERE system_id = ANY($1) ORDER BY name ASC LIMIT 30',
      [system_ids]
    );
    return res.rows;
  }
}

module.exports = PrivRole;
