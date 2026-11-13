// Privileged roles: one system each (or all_systems), with permissions of
// that system or for all systems.
import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, jsonList, searchRank, matchOrder } from '../../shared/db.js';
import { managedSystemsSql } from './priv-scope.js';

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

// Seen by a scope (priv-scope.js): "all systems" roles, and roles of a managed system
const visibleIn = (p) => `(r.all_systems OR r.system_id IN (${managedSystemsSql(p)}))`;

// filter: {search, system_id, permission_id, scope}
function filterWhere({ search = '', system_id, permission_id, scope = null }) {
  const w = new Where();
  if (permission_id) w.add(`EXISTS (SELECT 1 FROM priv_role_permissions x WHERE x.role_id = r.id AND x.permission_id = ${w.param(Number(permission_id))})`);
  w.search(search, ['r.name ILIKE ?', 'r.description ILIKE ?',
    'EXISTS (SELECT 1 FROM priv_role_permissions x JOIN priv_permissions pp ON pp.id = x.permission_id WHERE x.role_id = r.id AND pp.name ILIKE ?)']);
  if (system_id) w.add(`r.system_id = ${w.param(Number(system_id))}`);
  if (scope) w.add(visibleIn(w.param(scope.userId)));
  return w;
}

class PrivRole {
  static async create({ name, description, system_id, all_systems, updated_by }, client) {
    const result = await db(client).query(
      'INSERT INTO priv_roles (name, description, system_id, all_systems, updated_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description ?? null, system_id, !!all_systems, updated_by ?? null]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, system_id, all_systems, updated_by }, client) {
    await db(client).query(
      'UPDATE priv_roles SET name = $1, description = $2, system_id = $3, all_systems = $4, updated_by = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [name, description ?? null, system_id, !!all_systems, updated_by ?? null, id]
    );
  }

  static async remove(id, client) {
    await db(client).query('DELETE FROM priv_roles WHERE id = $1', [id]);
  }

  // scope: null, or only when the scope sees it
  static async findById(id, scope = null) {
    const result = scope
      ? await pool.query(`${SELECT_WITH_LINKS} WHERE r.id = $1 AND ${visibleIn('$2')} ${GROUP_BY}`, [id, scope.userId])
      : await pool.query(`${SELECT_WITH_LINKS} WHERE r.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM priv_roles WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Same name within the system, or among the "all systems" roles
  static async findByName(name, systemId, allSystems = false) {
    const result = allSystems
      ? await pool.query('SELECT * FROM priv_roles WHERE LOWER(name) = LOWER($1) AND all_systems', [name])
      : await pool.query('SELECT * FROM priv_roles WHERE LOWER(name) = LOWER($1) AND system_id = $2', [name, systemId]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY ${searchRank(['r.name'], filter.search, w)}r.updated_at DESC, r.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM priv_roles r WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2: roles of the given systems and the "all systems" roles, [{id, text}]
  // (text names the system when several are chosen; allLabel marks the "all systems" ones)
  static async searchForSystems(search = '', systemIds = [], allLabel = 'All systems') {
    if (!systemIds.length) return [];
    const result = await pool.query(
      `SELECT r.id, r.name || CASE WHEN r.all_systems THEN ' (' || $5 || ')' WHEN $3 THEN ' (' || s.name || ')' ELSE '' END AS text
       FROM priv_roles r LEFT JOIN systems s ON s.id = r.system_id
       WHERE (r.system_id = ANY($1::int[]) OR r.all_systems) AND r.name ILIKE $2
       ORDER BY r.all_systems, ${matchOrder('r.name', '$4')} LIMIT 30`,
      [systemIds, `%${search}%`, systemIds.length > 1, search, allLabel]
    );
    return result.rows;
  }

  static setPermissions(id, ids, client) { return replaceLinks(client, 'priv_role_permissions', 'role_id', id, 'permission_id', ids); }
}

export default PrivRole;
