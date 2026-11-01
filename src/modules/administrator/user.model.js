// Application users (login accounts) with their role.
import { pool } from '../../../config/config.js';
import { db, Where } from '../../shared/db.js';

const SELECT = 'SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id';

// filter: {search, role_id[], status ('active' | 'inactive'), auth_source[], twofa ('enabled' | 'required' | 'off')}
function filterWhere({ search = '', role_id = [], status, auth_source = [], twofa }) {
  const w = new Where();
  w.search(search, ['u.username ILIKE ?', 'u.email ILIKE ?', 'u.fullname ILIKE ?', 'r.name ILIKE ?']);
  if (role_id.length) w.add(`u.role_id = ANY(${w.param(role_id.map(Number))})`);
  if (status === 'active') w.add('u.is_active');
  if (status === 'inactive') w.add('NOT u.is_active');
  if (auth_source.length) w.add(`u.auth_source = ANY(${w.param(auth_source)})`);
  if (twofa === 'enabled') w.add('u.twofa_enabled');
  if (twofa === 'required') w.add('u.require_twofa AND NOT u.twofa_enabled');
  if (twofa === 'off') w.add('NOT u.require_twofa AND NOT u.twofa_enabled');
  return w;
}

const COLUMNS = ['username', 'email', 'fullname', 'role_id', 'password_hash', 'require_twofa', 'twofa_setup_deadline', 'must_change_password', 'is_active', 'auth_source'];

class User {
  static async create(data, client) {
    const cols = COLUMNS.filter((c) => data[c] !== undefined);
    const result = await db(client).query(
      `INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      cols.map((c) => data[c])
    );
    return result.rows[0];
  }

  // Only the given columns change
  static async update(id, data, client) {
    const cols = COLUMNS.concat(['twofa_secret', 'twofa_enabled']).filter((c) => data[c] !== undefined);
    if (!cols.length) return;
    await db(client).query(`UPDATE users SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`, [...cols.map((c) => data[c]), id]);
  }

  static async remove(id, client) {
    await db(client).query('DELETE FROM users WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT} WHERE u.id = $1`, [id]);
    return result.rows[0] || null;
  }

  // Exact match, as used by the login
  static async findByUsername(username) {
    const result = await pool.query(`${SELECT} WHERE u.username = $1 LIMIT 1`, [username]);
    return result.rows[0] || null;
  }

  // Another user whose username or email equals these ones, ignoring case
  static async findConflict({ username, email }, excludeId) {
    const result = await pool.query(
      `SELECT id, username, email FROM users WHERE (LOWER(username) = LOWER($1) OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))) AND id <> $3 LIMIT 1`,
      [username, email || null, excludeId || 0]
    );
    return result.rows[0] || null;
  }

  static async countActiveWithRole(roleName, excludeId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = $1 AND u.is_active AND u.id <> $2',
      [roleName, excludeId || 0]
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(`${SELECT} WHERE ${w} ORDER BY u.id LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`, w.params);
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Signs the user out everywhere (sessions are stored in the session table)
  static async endSessions(id, client) {
    await db(client).query("DELETE FROM session WHERE (sess->'user'->>'id')::int = $1", [id]);
  }

  // ===== Used by the login, 2FA and change-password pages =====
  static updateTwoFA(id, secret, enabled) { return User.update(id, { twofa_secret: secret, twofa_enabled: enabled }); }
  static updateTwofaDeadline(id, deadline) { return User.update(id, { twofa_setup_deadline: deadline }); }
  static updatePassword(id, hash) { return User.update(id, { password_hash: hash }); }
  static updateMustChangePassword(id, value) { return User.update(id, { must_change_password: value }); }
}

export default User;
