// Application roles and their permissions (role_permissions).
import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, jsonList, searchRank } from '../../shared/db.js';

export const SUPERADMIN = 'superadmin';

const SELECT_WITH_LINKS = `
  SELECT r.*,
    ${jsonList('p', { id: 'p.id', name: 'p.name' })} AS permissions,
    (SELECT COUNT(*)::int FROM users x WHERE x.role_id = r.id) AS user_count
  FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  LEFT JOIN permissions p ON p.id = rp.permission_id`;

function filterWhere({ search = '' }) {
  return new Where().search(search, ['r.name ILIKE ?', 'r.description ILIKE ?',
    'EXISTS (SELECT 1 FROM role_permissions x JOIN permissions pp ON pp.id = x.permission_id WHERE x.role_id = r.id AND pp.name ILIKE ?)']);
}

class Role {
  static async create({ name, description }, client) {
    const result = await db(client).query('INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *', [name, description ?? null]);
    return result.rows[0];
  }

  static async update(id, { name, description }, client) {
    await db(client).query('UPDATE roles SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [name, description ?? null, id]);
  }

  // role_permissions cascades
  static async remove(id, client) {
    await db(client).query('DELETE FROM roles WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE r.id = $1 GROUP BY r.id`, [id]);
    return result.rows[0] || null;
  }

  static async findByName(name) {
    const result = await pool.query('SELECT * FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
    return result.rows[0] || null;
  }

  // {id, text} for the user form and filters (a handful of rows)
  static async options() {
    const result = await pool.query('SELECT id, name AS text FROM roles ORDER BY name');
    return result.rows;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} GROUP BY r.id ORDER BY ${searchRank(['r.name'], filter.search, w)}r.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM roles r WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  static setPermissions(id, ids, client) { return replaceLinks(client, 'role_permissions', 'role_id', id, 'permission_id', ids); }

  // The superadmin role always holds every permission
  static async grantAllToSuperadmin(client) {
    await db(client).query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = $1
       AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id)`,
      [SUPERADMIN]
    );
  }
}

export default Role;
