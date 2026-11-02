import { pool } from '../../../config/config.js';
import { Where, searchRank } from '../../shared/db.js';

// Rows referencing a unit (it cannot be deleted while any exist)
const USAGE_SQL = {
  contacts: 'SELECT COUNT(*) FROM contacts WHERE unit_id = u.id',
  systems: 'SELECT COUNT(*) FROM systems WHERE department_id = u.id OR ops_department_id = u.id',
  priv_users: 'SELECT COUNT(*) FROM priv_users WHERE organize_id = u.id',
  rulefirewall: 'SELECT COUNT(*) FROM rulefirewall WHERE ou_id = u.id',
};
const usageColumns = Object.entries(USAGE_SQL).map(([key, sql]) => `(${sql})::int AS ${key}_count`).join(', ');

const filterWhere = ({ search = '' }) => new Where().search(search, ['u.name ILIKE ?', 'u.code ILIKE ?', 'u.description ILIKE ?']);

class Unit {
  static async create({ name, code, description }) {
    const result = await pool.query('INSERT INTO units (name, code, description) VALUES ($1, $2, $3) RETURNING *', [name, code || null, description]);
    return result.rows[0];
  }

  static async update(id, { name, code, description }) {
    const result = await pool.query('UPDATE units SET name = $1, code = $2, description = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *', [name, code || null, description, id]);
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM units WHERE id = $1', [id]);
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM units ORDER BY name');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [id]);
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

  // Page of units with their usage counts (<key>_count)
  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `SELECT u.*, ${usageColumns} FROM units u WHERE ${w} ORDER BY ${searchRank(['u.name'], filter.search, w)}u.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
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

  // Select2 lookup: [{id, text}]
  // Every unit as {id, text}, for selects rendered with the page
  static async options() {
    const result = await pool.query('SELECT id, name AS text FROM units ORDER BY name');
    return result.rows;
  }

  static async select2Search(search = '') {
    const w = filterWhere({ search });
    const result = await pool.query(`SELECT u.id, u.name AS text FROM units u WHERE ${w} ORDER BY ${searchRank(['u.name'], search, w)}u.name LIMIT 20`, w.params);
    return result.rows;
  }
}

export default Unit;
