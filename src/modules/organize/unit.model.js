import { pool } from '../../../config/config.js';
import { Where, NONE, searchRank } from '../../shared/db.js';

// Rows referencing a unit (it cannot be deleted while any exist)
const USAGE_SQL = {
  contacts: 'SELECT COUNT(*) FROM contacts WHERE unit_id = u.id',
  systems: 'SELECT COUNT(*) FROM systems WHERE department_id = u.id OR ops_department_id = u.id',
  priv_users: 'SELECT COUNT(*) FROM priv_users WHERE organize_id = u.id',
  rulefirewall: 'SELECT COUNT(*) FROM rulefirewall WHERE ou_id = u.id',
  users: 'SELECT COUNT(*) FROM users x WHERE x.unit_id = u.id OR EXISTS (SELECT 1 FROM user_scope_units su WHERE su.user_id = x.id AND su.unit_id = u.id)',
};
const usageColumns = Object.entries(USAGE_SQL).map(([key, sql]) => `(${sql})::int AS ${key}_count`).join(', ');

// Units nest through parent_id. MAX_DEPTH only guards the recursive queries.
const MAX_DEPTH = 20;
// "Division › Department" of u's ancestors (top first), null for a top-level unit
const PARENT_PATH = `(
  WITH RECURSIVE a AS (
    SELECT p.id, p.parent_id, p.name, 1 AS d FROM units p WHERE p.id = u.parent_id
    UNION ALL
    SELECT p.id, p.parent_id, p.name, a.d + 1 FROM units p JOIN a ON p.id = a.parent_id WHERE a.d < ${MAX_DEPTH}
  ) SELECT string_agg(name, ' › ' ORDER BY d DESC) FROM a)`;
const CHILDREN_COUNT = '(SELECT COUNT(*) FROM units c WHERE c.parent_id = u.id)::int';
// A unit with no sub-unit: the only kind other pages can pick
const IS_LEAF = 'NOT EXISTS (SELECT 1 FROM units c WHERE c.parent_id = u.id)';
const descendantsOf = (p) => `(
  WITH RECURSIVE d AS (
    SELECT id, 1 AS depth FROM units WHERE parent_id = ${p}
    UNION ALL
    SELECT c.id, d.depth + 1 FROM units c JOIN d ON c.parent_id = d.id WHERE d.depth < ${MAX_DEPTH}
  ) SELECT id FROM d)`;

// SQL set: the unit p and every sub-unit of it (filters "by unit, sub-units included")
export const unitSubtree = (p) => `(SELECT ${p}::int UNION SELECT id FROM ${descendantsOf(p)} sub)`;

// filter: {search, parent_id (unit id: its sub-units at any depth, NONE: top-level units), level ('parent' | 'leaf')}
function filterWhere({ search = '', parent_id = '', level = '' }) {
  const w = new Where().search(search, ['u.name ILIKE ?', 'u.code ILIKE ?', 'u.description ILIKE ?']);
  if (parent_id === NONE) w.add('u.parent_id IS NULL');
  else if (Number(parent_id)) w.add(`u.id IN ${descendantsOf(w.param(Number(parent_id)))}`);
  if (level === 'parent') w.add(`NOT ${IS_LEAF}`);
  else if (level === 'leaf') w.add(IS_LEAF);
  return w;
}

class Unit {
  static async create({ name, code, description, parent_id }) {
    const result = await pool.query('INSERT INTO units (name, code, description, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, code || null, description, parent_id || null]);
    return result.rows[0];
  }

  static async update(id, { name, code, description, parent_id }) {
    const result = await pool.query('UPDATE units SET name = $1, code = $2, description = $3, parent_id = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [name, code || null, description, parent_id || null, id]);
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM units WHERE id = $1', [id]);
  }

  // Lowest-level units (no sub-unit), for the list filters of other pages
  static async findLeaves() {
    const result = await pool.query(`SELECT * FROM units u WHERE ${IS_LEAF} ORDER BY name`);
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(`SELECT u.*, ${PARENT_PATH} AS parent_path, ${CHILDREN_COUNT} AS children_count FROM units u WHERE u.id = $1`, [id]);
    return result.rows[0];
  }

  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM units WHERE id = ANY($1) ORDER BY name', [ids]);
    return result.rows;
  }

  // Case- and space-insensitive
  static async findByName(name) {
    const result = await pool.query('SELECT * FROM units WHERE lower(trim(name)) = lower(trim($1))', [name]);
    return result.rows[0];
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM units WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Ids of every sub-unit of id, at any depth (cycle check)
  static async descendantIds(id) {
    const result = await pool.query(`SELECT id FROM ${descendantsOf('$1')} x`, [id]);
    return result.rows.map((r) => r.id);
  }

  // Direct sub-units (unit detail)
  static async findChildren(id) {
    const result = await pool.query(`SELECT u.id, u.name, u.code, ${CHILDREN_COUNT} AS children_count FROM units u WHERE u.parent_id = $1 ORDER BY u.name`, [id]);
    return result.rows;
  }

  // Page of units with their parent path, sub-unit count and usage counts (<key>_count)
  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `SELECT u.*, ${PARENT_PATH} AS parent_path, ${CHILDREN_COUNT} AS children_count, ${usageColumns}
       FROM units u WHERE ${w} ORDER BY ${searchRank(['u.name'], filter.search, w)}u.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM units u WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // { contacts, systems, priv_users, rulefirewall }
  static async getUsageBreakdown(id) {
    const result = await pool.query(`SELECT ${usageColumns} FROM units u WHERE u.id = $1`, [id]);
    const row = result.rows[0] || {};
    return Object.fromEntries(Object.keys(USAGE_SQL).map((key) => [key, row[`${key}_count`] || 0]));
  }

  // Units as {id, text} for selects rendered with the page. Other pages pick
  // lowest-level units only: a unit with sub-units is { hidden: true }, shown
  // only when it is a record's current value (ui.options).
  static async options() {
    const result = await pool.query(`SELECT u.id, u.name AS text, NOT ${IS_LEAF} AS hidden FROM units u ORDER BY u.name`);
    return result.rows;
  }

  // Every unit as {id, text: "Division › Department › Team"} (unit page: parent picker and filter)
  static async pathOptions() {
    const result = await pool.query(`SELECT u.id, COALESCE(${PARENT_PATH} || ' › ', '') || u.name AS text FROM units u ORDER BY text`);
    return result.rows;
  }

  // Select2 lookup of other pages: lowest-level units only, [{id, text}]
  static async select2Search(search = '') {
    const w = filterWhere({ search, level: 'leaf' });
    const result = await pool.query(`SELECT u.id, u.name AS text FROM units u WHERE ${w} ORDER BY ${searchRank(['u.name'], search, w)}u.name LIMIT 20`, w.params);
    return result.rows;
  }
}

export default Unit;
