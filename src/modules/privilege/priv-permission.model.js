// Privileged permissions: named per system (UNIQUE (name, system_id)), or
// for all systems (all_systems, unique name among them).
import { pool } from '../../../config/config.js';
import { db, Where, searchRank, matchOrder } from '../../shared/db.js';
import { managedSystemsSql } from './priv-scope.js';

const SELECT_WITH_LINKS = `
  SELECT p.*,
    CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id', s.id, 'name', s.name) END AS system,
    (SELECT COUNT(*)::int FROM priv_role_permissions x WHERE x.permission_id = p.id) AS role_count
  FROM priv_permissions p
  LEFT JOIN systems s ON s.id = p.system_id`;

// Seen by a scope (priv-scope.js): "all systems" permissions, and those of a managed system
const visibleIn = (p) => `(p.all_systems OR p.system_id IN (${managedSystemsSql(p)}))`;

// filter: {search, system_id, scope}
function filterWhere({ search = '', system_id, scope = null }) {
  const w = new Where();
  w.search(search, ['p.name ILIKE ?', 'p.description ILIKE ?']);
  if (system_id) w.add(`p.system_id = ${w.param(Number(system_id))}`);
  if (scope) w.add(visibleIn(w.param(scope.userId)));
  return w;
}

class PrivPermission {
  static async create({ name, description, system_id, all_systems, updated_by }, client) {
    const result = await db(client).query(
      'INSERT INTO priv_permissions (name, description, system_id, all_systems, updated_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description ?? null, system_id, !!all_systems, updated_by ?? null]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, system_id, all_systems, updated_by }, client) {
    await db(client).query(
      'UPDATE priv_permissions SET name = $1, description = $2, system_id = $3, all_systems = $4, updated_by = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [name, description ?? null, system_id, !!all_systems, updated_by ?? null, id]
    );
  }

  // priv_role_permissions cascades
  static async remove(id, client) {
    await db(client).query('DELETE FROM priv_permissions WHERE id = $1', [id]);
  }

  // scope: null, or only when the scope sees it
  static async findById(id, scope = null) {
    const result = scope
      ? await pool.query(`${SELECT_WITH_LINKS} WHERE p.id = $1 AND ${visibleIn('$2')}`, [id, scope.userId])
      : await pool.query(`${SELECT_WITH_LINKS} WHERE p.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ORDER BY ${searchRank(['p.name'], filter.search, w)}p.updated_at DESC, p.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM priv_permissions p WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Permission ids a role may not hold: a role of one system holds that system's
  // permissions and the "all systems" ones; an "all systems" role holds any
  static async foreignIds(ids, systemId, allSystems = false) {
    if (!ids.length || allSystems) return [];
    const result = await pool.query(
      'SELECT id FROM unnest($1::int[]) AS id WHERE id NOT IN (SELECT id FROM priv_permissions WHERE system_id = $2 OR all_systems)', [ids, systemId]);
    return result.rows.map((r) => r.id);
  }

  // Select2: permissions a role may hold (see foreignIds), [{id, text}];
  // allLabel names the "all systems" ones, the system is named for an "all systems" role
  static async searchForSystem(search = '', systemId, allSystems = false, allLabel = 'All systems') {
    if (!systemId && !allSystems) return [];
    const result = await pool.query(
      `SELECT p.id, p.name || CASE WHEN p.all_systems THEN ' (' || $4 || ')' WHEN $5 THEN ' (' || s.name || ')' ELSE '' END AS text
       FROM priv_permissions p LEFT JOIN systems s ON s.id = p.system_id
       WHERE ($5 OR p.system_id = $1 OR p.all_systems) AND p.name ILIKE $2
       ORDER BY p.all_systems, ${matchOrder('p.name', '$3')} LIMIT 50`,
      [systemId, `%${search}%`, search, allLabel, !!allSystems]
    );
    return result.rows;
  }
}

export default PrivPermission;
