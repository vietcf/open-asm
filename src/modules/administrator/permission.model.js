// Application permissions ("<resource>.<action>").
import { pool } from '../../../config/config.js';
import { db, Where, searchRank } from '../../shared/db.js';

const SELECT = `SELECT p.*, (SELECT COUNT(*)::int FROM role_permissions x WHERE x.permission_id = p.id) AS role_count FROM permissions p`;

const filterWhere = ({ search = '' }) => new Where().search(search, ['p.name ILIKE ?', 'p.description ILIKE ?']);

class Permission {
  static async create({ name, description }, client) {
    const result = await db(client).query('INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *', [name, description ?? null]);
    return result.rows[0];
  }

  // The name is immutable (code checks it)
  static async update(id, { description }, client) {
    await db(client).query('UPDATE permissions SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [description ?? null, id]);
  }

  // role_permissions cascades
  static async remove(id, client) {
    await db(client).query('DELETE FROM permissions WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT} WHERE p.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async findByName(name) {
    const result = await pool.query('SELECT * FROM permissions WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  // Every permission (the role form shows them all, grouped by resource)
  static async findAll() {
    const result = await pool.query('SELECT id, name, description FROM permissions ORDER BY name');
    return result.rows;
  }

  static async findByRoleId(roleId) {
    const result = await pool.query(
      'SELECT p.id, p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1',
      [roleId]
    );
    return result.rows;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(`${SELECT} WHERE ${w} ORDER BY ${searchRank(['p.name'], filter.search, w)}p.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`, w.params);
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM permissions p WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }
}

export default Permission;
