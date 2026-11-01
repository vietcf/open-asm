// Privileged roles: one system each, with permissions of that system.
import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, jsonList } from '../../shared/db.js';

const SELECT_WITH_LINKS = `
  SELECT r.*,
    CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id', s.id, 'name', s.name) END AS system,
    ${jsonList('p', { id: 'p.id', name: 'p.name', description: 'p.description' })} AS permissions,
    (SELECT COUNT(*)::int FROM priv_users x WHERE x.role_id = r.id) AS account_count
  FROM priv_roles r
  LEFT JOIN systems s ON s.id = r.system_id
  LEFT JOIN priv_role_permissions rp ON rp.role_id = r.id
  LEFT JOIN priv_permissions p ON p.id = rp.permission_id`;
const GROUP_BY = 'GROUP BY r.id, s.id';

// filter: {search, system_id}
function filterWhere({ search = '', system_id }) {
  const w = new Where();
  w.search(search, ['r.name ILIKE ?', 'r.description ILIKE ?',
    'EXISTS (SELECT 1 FROM priv_role_permissions x JOIN priv_permissions pp ON pp.id = x.permission_id WHERE x.role_id = r.id AND pp.name ILIKE ?)']);
  if (system_id) w.add(`r.system_id = ${w.param(Number(system_id))}`);
  return w;
}

class PrivRole {
  static async create({ name, description, system_id, updated_by }, client) {
    const result = await db(client).query(
      'INSERT INTO priv_roles (name, description, system_id, updated_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description ?? null, system_id, updated_by ?? null]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, system_id, updated_by }, client) {
    await db(client).query(
      'UPDATE priv_roles SET name = $1, description = $2, system_id = $3, updated_by = $4, updated_date = CURRENT_TIMESTAMP WHERE id = $5',
      [name, description ?? null, system_id, updated_by ?? null, id]
    );
  }

  static async remove(id, client) {
    await db(client).query('DELETE FROM priv_roles WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE r.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM priv_roles WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findByName(name, systemId) {
    const result = await pool.query('SELECT * FROM priv_roles WHERE LOWER(name) = LOWER($1) AND system_id = $2', [name, systemId]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY r.updated_date DESC, r.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM priv_roles r WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2: roles of the given systems, [{id, text}] (text includes the system when several)
  static async searchForSystems(search = '', systemIds = []) {
    if (!systemIds.length) return [];
    const result = await pool.query(
      `SELECT r.id, r.name || CASE WHEN $3 THEN ' (' || s.name || ')' ELSE '' END AS text
       FROM priv_roles r JOIN systems s ON s.id = r.system_id
       WHERE r.system_id = ANY($1::int[]) AND r.name ILIKE $2 ORDER BY r.name LIMIT 30`,
      [systemIds, `%${search}%`, systemIds.length > 1]
    );
    return result.rows;
  }

  static setPermissions(id, ids, client) { return replaceLinks(client, 'priv_role_permissions', 'role_id', id, 'permission_id', ids); }
}

export default PrivRole;
