import { pool } from '../../../config/config.js';

// system_log: one row per audited event.
//   category  'security' (security audit) | 'app' (application log)
//   level     'info' | 'warning' | 'critical'
export const LOG_CATEGORIES = ['app', 'security'];
export const LOG_LEVELS = ['info', 'warning', 'critical'];

// filter = { category, search, dateFrom, dateTo, username, action, objectType,
//            status, level, ip }; every field optional.
function buildWhere(filter = {}) {
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (LOG_CATEGORIES.includes(filter.category)) add('category = ?', filter.category);
  if (filter.search) {
    params.push(`%${filter.search}%`);
    const p = `$${params.length}`;
    where.push(`(username ILIKE ${p} OR action ILIKE ${p} OR description ILIKE ${p} OR object_type ILIKE ${p} OR object_id ILIKE ${p} OR ip_address ILIKE ${p})`);
  }
  if (filter.dateFrom) add('created_at >= ?::date', filter.dateFrom);
  if (filter.dateTo) add(`created_at < ?::date + INTERVAL '1 day'`, filter.dateTo);
  if (filter.username) add('username = ?', filter.username);
  if (filter.action) add('action = ?', filter.action);
  if (filter.objectType) add('object_type = ?', filter.objectType);
  if (filter.status) add('status = ?', filter.status);
  if (LOG_LEVELS.includes(filter.level)) add('level = ?', filter.level);
  if (filter.ip) add('ip_address ILIKE ?', `%${filter.ip}%`);
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const SystemLog = {
  async create(log) {
    await pool.query(
      `INSERT INTO system_log (action, object_type, object_id, description, user_id, username, ip_address, user_agent, status, category, level, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [
        log.action,
        log.object_type || null,
        log.object_id != null ? String(log.object_id) : null,
        log.description || '',
        log.user_id || null,
        log.username || null,
        log.ip_address || null,
        log.user_agent || null,
        log.status || null,
        LOG_CATEGORIES.includes(log.category) ? log.category : 'app',
        LOG_LEVELS.includes(log.level) ? log.level : 'info',
      ]
    );
  },

  async findFiltered(filter, { page = 1, pageSize = 20 } = {}) {
    const { sql, params } = buildWhere(filter);
    const res = await pool.query(
      `SELECT * FROM system_log ${sql} ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return res.rows;
  },

  async countFiltered(filter) {
    const { sql, params } = buildWhere(filter);
    const res = await pool.query(`SELECT COUNT(*)::int AS n FROM system_log ${sql}`, params);
    return res.rows[0].n;
  },

  // Distinct values of one column within a category, for the filter selects.
  async distinctValues(column, category) {
    if (!['username', 'action', 'object_type', 'status'].includes(column)) throw new Error('Invalid column');
    const res = await pool.query(
      `SELECT DISTINCT ${column} AS v FROM system_log
        WHERE ${column} IS NOT NULL AND ${column} <> '' AND category = $1
        ORDER BY 1 LIMIT 500`,
      [category]
    );
    return res.rows.map(r => r.v);
  },
};

export default SystemLog;
