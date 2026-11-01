// Privileged permissions: named per system (UNIQUE (name, system_id)).
import { pool } from '../../../config/config.js';
import { db, Where } from '../../shared/db.js';

const SELECT_WITH_LINKS = `
  SELECT p.*,
    CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id', s.id, 'name', s.name) END AS system,
    (SELECT COUNT(*)::int FROM priv_role_permissions x WHERE x.permission_id = p.id) AS role_count
  FROM priv_permissions p
  LEFT JOIN systems s ON s.id = p.system_id`;

// filter: {search, system_id}
function filterWhere({ search = '', system_id }) {
  const w = new Where();
  w.search(search, ['p.name ILIKE ?', 'p.description ILIKE ?']);
  if (system_id) w.add(`p.system_id = ${w.param(Number(system_id))}`);
  return w;
}

class PrivPermission {
  static async create({ name, description, system_id, updated_by }, client) {
    const result = await db(client).query(
      'INSERT INTO priv_permissions (name, description, system_id, updated_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description ?? null, system_id, updated_by ?? null]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, system_id, updated_by }, client) {
    await db(client).query(
      'UPDATE priv_permissions SET name = $1, description = $2, system_id = $3, updated_by = $4, updated_date = CURRENT_TIMESTAMP WHERE id = $5',
      [name, description ?? null, system_id, updated_by ?? null, id]
    );
  }

  // priv_role_permissions cascades
  static async remove(id, client) {
    await db(client).query('DELETE FROM priv_permissions WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE p.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ORDER BY p.updated_date DESC, p.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM priv_permissions p WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Permission ids that do not belong to the system
  static async foreignIds(ids, systemId) {
    if (!ids.length) return [];
    const result = await pool.query('SELECT id FROM unnest($1::int[]) AS id WHERE id NOT IN (SELECT id FROM priv_permissions WHERE system_id = $2)', [ids, systemId]);
    return result.rows.map((r) => r.id);
  }

  // Select2: permissions of one system, [{id, text}]
  static async searchForSystem(search = '', systemId) {
    if (!systemId) return [];
    const result = await pool.query(
      'SELECT id, name AS text FROM priv_permissions WHERE system_id = $1 AND name ILIKE $2 ORDER BY name LIMIT 50',
      [systemId, `%${search}%`]
    );
    return result.rows;
  }
}

export default PrivPermission;
