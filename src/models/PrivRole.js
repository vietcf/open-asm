import { pool } from '../../config/config.js';

/**
 * PrivRole Model - handles all database operations for privileged roles and their relationships.
 * Naming convention: All methods use get/set prefix for clarity and consistency.
 */
class PrivRole {
  /**
   * List roles with optional search, system_id filter, pagination, and system join.
   * Returns: { roles: [...], totalCount, totalPages }
   */
  static async findFilteredList({ search = '', system_id = '', page = 1, pageSize = 10 }) {
    let where = [];
    let params = [];
    let idx = 1;
    if (search) {
      where.push(`(r.name ILIKE $${idx} OR r.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (system_id) {
      where.push(`r.system_id = $${idx}`);
      params.push(system_id);
      idx++;
    }
    const whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    params.push(pageSize, (page - 1) * pageSize);
    const pageRes = await pool.query(
      `SELECT r.*, s.id as system_id, s.name as system_name FROM priv_roles r LEFT JOIN systems s ON r.system_id = s.id ${whereClause} ORDER BY r.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const roles = pageRes.rows.map(row => ({
      ...row,
      system: row.system_id ? { id: row.system_id, name: row.system_name } : null
    }));
    return roles;
  }

  static async countFilteredList({ search = '', system_id = '' }) {
    let where = [];
    let params = [];
    let idx = 1;
    if (search) {
      where.push(`(r.name ILIKE $${idx} OR r.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (system_id) {
      where.push(`r.system_id = $${idx}`);
      params.push(system_id);
      idx++;
    }
    const whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM priv_roles r ${whereClause}`, params);
    return parseInt(countRes.rows[0].count, 10);
  }
  // ===== CRUD METHODS =====
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
  static async remove(id) {
    await pool.query('DELETE FROM priv_roles WHERE id = $1', [id]);
  }
  static async findFilteredPage(search, page = 1, pageSize = 10) {
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
  static async countFiltered(search) {
    const q = `%${search}%`;
    const res = await pool.query(
      `SELECT COUNT(*) FROM priv_roles
       WHERE name ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(res.rows[0].count, 10);
  }
  static async findForSystemSelect2(search, system_ids) {
    const q = `%${search}%`;
    if (Array.isArray(system_ids)) {
      system_ids = system_ids.filter(x => x !== undefined && x !== null && x !== '');
    }
    let sql = `SELECT id, name FROM priv_roles WHERE (name ILIKE $1 OR description ILIKE $1)`;
    let params = [q];
    if (system_ids && Array.isArray(system_ids) && system_ids.length > 0) {
      sql += ' AND system_id = ANY($2)';
      params.push(system_ids);
    } else {
      return [];
    }
    sql += ' ORDER BY name ASC LIMIT 30';
    const res = await pool.query(sql, params);
    return res.rows;
  }
  static async findPermissions(roleId) {
    const res = await pool.query(
      `SELECT p.* FROM priv_role_permissions rp JOIN priv_permissions p ON rp.permission_id = p.id WHERE rp.role_id = $1 ORDER BY p.name`,
      [roleId]
    );
    return res.rows;
  }
  // ===== COMPATIBILITY SHIM =====
  static async getPermissions(roleId) {
    // For legacy compatibility: alias for findPermissions
    return this.findPermissions(roleId);
  }
  static async setPermissions(roleId, permissionIds) {
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
  static async findBySystemIds(system_ids) {
    if (!Array.isArray(system_ids) || !system_ids.length) return [];
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

export default PrivRole;
