// Privileged accounts (priv_users) with unit, role, contacts, systems and servers.
import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, subList, searchRank } from '../../shared/db.js';
import { managedSystemsSql } from './priv-scope.js';

// One subquery per list (no join fan-out, no GROUP BY).
const SELECT_WITH_LINKS = `
  SELECT pu.*,
    CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id', u.id, 'name', u.name) END AS organize,
    CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'name', r.name) END AS role,
    ${subList({ id: 'c.id', name: 'c.name', email: 'c.email' },
      'FROM priv_user_contacts puc JOIN contacts c ON c.id = puc.contact_id WHERE puc.user_id = pu.id', 'c.id')} AS contacts,
    ${subList({ id: 's.id', name: 's.name' },
      'FROM priv_user_systems pus JOIN systems s ON s.id = pus.system_id WHERE pus.user_id = pu.id', 's.id')} AS systems,
    ${subList({ id: 'srv.id', name: 'srv.name' },
      'FROM priv_user_servers pusv JOIN servers srv ON srv.id = pusv.server_id WHERE pusv.user_id = pu.id', 'srv.id')} AS servers
  FROM priv_users pu
  LEFT JOIN units u ON u.id = pu.organize_id
  LEFT JOIN priv_roles r ON r.id = pu.role_id`;

// Seen: one of its systems is managed by the scope (priv-scope.js)
const visibleIn = (p) => `EXISTS (SELECT 1 FROM priv_user_systems x WHERE x.user_id = pu.id AND x.system_id IN (${managedSystemsSql(p)}))`;
// Changeable: every one of its systems is managed
const editableIn = (p) => `NOT EXISTS (SELECT 1 FROM priv_user_systems x WHERE x.user_id = pu.id AND x.system_id NOT IN (${managedSystemsSql(p)}))`;

// filter: {search, system_ids[], organize_id, contact_ids[], account_type[], manage_type[], scope}
function filterWhere({ search = '', system_ids = [], organize_id, contact_ids = [], account_type = [], manage_type = [], scope = null }) {
  const w = new Where();
  if (scope) w.add(visibleIn(w.param(scope.userId)));
  w.search(search, ['pu.username ILIKE ?', 'pu.description ILIKE ?', 'pu.app_url ILIKE ?',
    'EXISTS (SELECT 1 FROM priv_roles x WHERE x.id = pu.role_id AND x.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM priv_user_servers x JOIN servers sv ON sv.id = x.server_id WHERE x.user_id = pu.id AND sv.name ILIKE ?)']);
  if (system_ids.length) w.add(`EXISTS (SELECT 1 FROM priv_user_systems x WHERE x.user_id = pu.id AND x.system_id = ANY(${w.param(system_ids.map(Number))}))`);
  if (contact_ids.length) w.add(`EXISTS (SELECT 1 FROM priv_user_contacts x WHERE x.user_id = pu.id AND x.contact_id = ANY(${w.param(contact_ids.map(Number))}))`);
  if (organize_id) w.add(`pu.organize_id = ${w.param(Number(organize_id))}`);
  if (account_type.length) w.add(`pu.account_type = ANY(${w.param(account_type)})`);
  if (manage_type.length) w.add(`pu.manage_type = ANY(${w.param(manage_type)})`);
  return w;
}

const COLUMNS = ['username', 'description', 'organize_id', 'role_id', 'account_type', 'manage_type', 'app_url', 'updated_by'];

class PrivUser {
  static async create(data, client) {
    const result = await db(client).query(
      `INSERT INTO priv_users (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      COLUMNS.map((c) => data[c] ?? null)
    );
    return result.rows[0];
  }

  static async update(id, data, client) {
    await db(client).query(
      `UPDATE priv_users SET ${COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${COLUMNS.length + 1}`,
      [...COLUMNS.map((c) => data[c] ?? null), id]
    );
  }

  // Link tables cascade
  static async remove(id, client) {
    await db(client).query('DELETE FROM priv_users WHERE id = $1', [id]);
  }

  // scope: null, or only when it is seen there; can_edit tells whether the scope may change it
  static async findById(id, scope = null) {
    const result = scope
      ? await pool.query(`SELECT * FROM (${SELECT_WITH_LINKS.replace('SELECT pu.*,', `SELECT pu.*, ${editableIn('$2')} AS can_edit,`)} WHERE pu.id = $1 AND ${visibleIn('$2')}) x`, [id, scope.userId])
      : await pool.query(`${SELECT_WITH_LINKS} WHERE pu.id = $1`, [id]);
    const row = result.rows[0] || null;
    if (row && !scope) row.can_edit = true;
    return row;
  }

  static async findByUsername(username) {
    const result = await pool.query('SELECT * FROM priv_users WHERE LOWER(username) = LOWER($1)', [username]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const select = filter.scope ? SELECT_WITH_LINKS.replace('SELECT pu.*,', `SELECT pu.*, ${editableIn(w.param(filter.scope.userId))} AS can_edit,`) : SELECT_WITH_LINKS;
    const result = await pool.query(
      `${select} WHERE ${w} ORDER BY ${searchRank(['pu.username'], filter.search, w)}pu.updated_at DESC, pu.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    if (!filter.scope) result.rows.forEach((r) => { r.can_edit = true; });
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM priv_users pu WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  static setContacts(id, ids, client) { return replaceLinks(client, 'priv_user_contacts', 'user_id', id, 'contact_id', ids); }
  static setSystems(id, ids, client) { return replaceLinks(client, 'priv_user_systems', 'user_id', id, 'system_id', ids); }
  static setServers(id, ids, client) { return replaceLinks(client, 'priv_user_servers', 'user_id', id, 'server_id', ids); }
}

export default PrivUser;
