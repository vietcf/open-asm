// Privileged accounts (priv_users) with unit, role, contacts, systems and servers.
import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, jsonList } from '../../shared/db.js';

const SELECT_WITH_LINKS = `
  SELECT pu.*,
    CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id', u.id, 'name', u.name) END AS organize,
    CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'name', r.name) END AS role,
    ${jsonList('c', { id: 'c.id', name: 'c.name', email: 'c.email' })} AS contacts,
    ${jsonList('s', { id: 's.id', name: 's.name' })} AS systems,
    ${jsonList('srv', { id: 'srv.id', name: 'srv.name' })} AS servers
  FROM priv_users pu
  LEFT JOIN units u ON u.id = pu.organize_id
  LEFT JOIN priv_roles r ON r.id = pu.role_id
  LEFT JOIN priv_user_contacts puc ON puc.user_id = pu.id
  LEFT JOIN contacts c ON c.id = puc.contact_id
  LEFT JOIN priv_user_systems pus ON pus.user_id = pu.id
  LEFT JOIN systems s ON s.id = pus.system_id
  LEFT JOIN priv_user_servers pusv ON pusv.user_id = pu.id
  LEFT JOIN servers srv ON srv.id = pusv.server_id`;
const GROUP_BY = 'GROUP BY pu.id, u.id, r.id';

// filter: {search, system_ids[], organize_id, contact_ids[], account_type[], manage_type[]}
function filterWhere({ search = '', system_ids = [], organize_id, contact_ids = [], account_type = [], manage_type = [] }) {
  const w = new Where();
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
      `UPDATE priv_users SET ${COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_date = CURRENT_TIMESTAMP WHERE id = $${COLUMNS.length + 1}`,
      [...COLUMNS.map((c) => data[c] ?? null), id]
    );
  }

  // Link tables cascade
  static async remove(id, client) {
    await db(client).query('DELETE FROM priv_users WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE pu.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  static async findByUsername(username) {
    const result = await pool.query('SELECT * FROM priv_users WHERE LOWER(username) = LOWER($1)', [username]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY pu.updated_date DESC, pu.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
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
