import { pool } from '../../../config/config.js';
import { db, Where, jsonList } from '../../shared/db.js';

const COLUMNS = ['name', 'domain', 'provider', 'ip_address', 'port', 'protocol', 'direction', 'scope', 'access_mode', 'allowed_ips', 'device_id', 'system_id', 'description', 'updated_by'];

const SELECT_WITH_LINKS = `
  SELECT vs.*,
    dev.name AS device_name, sys.name AS system_name,
    ${jsonList('srv', { server_id: 'srv.id', server_name: 'srv.name', port: 'm.port', status: 'm.status' })} AS members
  FROM virtual_servers vs
  LEFT JOIN devices dev ON dev.id = vs.device_id
  LEFT JOIN systems sys ON sys.id = vs.system_id
  LEFT JOIN virtual_server_members m ON m.virtual_server_id = vs.id
  LEFT JOIN servers srv ON srv.id = m.server_id`;
const GROUP_BY = 'GROUP BY vs.id, dev.name, sys.name';

function filterWhere({ search = '', protocol, provider, device_id, system_id, direction, scope, access_mode }) {
  const w = new Where();
  w.search(search, [
    'vs.name ILIKE ?', 'vs.domain ILIKE ?', 'vs.ip_address ILIKE ?', 'vs.provider ILIKE ?',
    'EXISTS (SELECT 1 FROM devices x WHERE x.id = vs.device_id AND x.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM systems x WHERE x.id = vs.system_id AND x.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM virtual_server_members x JOIN servers s ON s.id = x.server_id WHERE x.virtual_server_id = vs.id AND s.name ILIKE ?)',
  ]);
  if (protocol) w.add(`vs.protocol = ${w.param(protocol)}`);
  if (provider) w.add(`vs.provider = ${w.param(provider)}`);
  if (device_id) w.add(`vs.device_id = ${w.param(Number(device_id))}`);
  if (direction) w.add(`vs.direction = ${w.param(direction)}`);
  if (scope) w.add(`vs.scope = ${w.param(scope)}`);
  if (access_mode) w.add(`vs.access_mode = ${w.param(access_mode)}`);
  if (system_id) w.add(`vs.system_id = ${w.param(Number(system_id))}`);
  return w;
}

class ServiceMapping {
  static async create(data, client) {
    const cols = COLUMNS.filter((c) => data[c] !== undefined);
    const vals = cols.map((c) => data[c]);
    const ph = cols.map((_, i) => `$${i + 1}`);
    const result = await db(client).query(
      `INSERT INTO virtual_servers (${cols.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`, vals);
    return result.rows[0];
  }

  static async update(id, data, client) {
    const cols = COLUMNS.filter((c) => data[c] !== undefined);
    const sets = cols.map((c, i) => `${c} = $${i + 1}`);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    const vals = [...cols.map((c) => data[c]), id];
    const result = await db(client).query(
      `UPDATE virtual_servers SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return result.rows[0];
  }

  static async delete(id, client) {
    await db(client).query('DELETE FROM virtual_servers WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM virtual_servers WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM virtual_servers WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findByIdWithRelations(id, client) {
    const result = await db(client).query(`${SELECT_WITH_LINKS} WHERE vs.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  static async findByNameExact(name) {
    const result = await pool.query('SELECT * FROM virtual_servers WHERE LOWER(name) = LOWER($1) ORDER BY id', [name]);
    return result.rows;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY vs.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params);
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM virtual_servers vs WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Virtual servers on a specific device (Device detail page)
  static async findByDeviceId(deviceId) {
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE vs.device_id = $1 ${GROUP_BY} ORDER BY vs.id DESC`, [deviceId]);
    return result.rows;
  }

  // Virtual servers whose backend includes a specific server (Server detail page)
  static async findByServerId(serverId) {
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE EXISTS (SELECT 1 FROM virtual_server_members x WHERE x.virtual_server_id = vs.id AND x.server_id = $1) ${GROUP_BY} ORDER BY vs.id DESC`,
      [serverId]);
    return result.rows;
  }

  // Provider values already used, offered as suggestions
  static async getDistinctProviders() {
    const result = await pool.query("SELECT DISTINCT provider FROM virtual_servers WHERE provider IS NOT NULL AND provider <> '' ORDER BY provider");
    return result.rows.map((r) => r.provider);
  }

  // Protocol values
  static async getDistinctProtocols() {
    const result = await pool.query("SELECT DISTINCT protocol FROM virtual_servers WHERE protocol IS NOT NULL ORDER BY protocol");
    return result.rows.map((r) => r.protocol);
  }

  // ===== Links =====
  static async setMembers(vsId, members, client) {
    const ex = db(client);
    await ex.query('DELETE FROM virtual_server_members WHERE virtual_server_id = $1', [vsId]);
    for (const m of members || []) {
      await ex.query(
        'INSERT INTO virtual_server_members (virtual_server_id, server_id, port, status) VALUES ($1, $2, $3, $4)',
        [vsId, m.server_id, m.port || null, m.status || 'active']);
    }
  }

  // Select2 search
  static async select2Search(search) {
    const w = new Where();
    w.search(search, ['vs.name ILIKE ?', 'vs.domain ILIKE ?', 'vs.ip_address ILIKE ?']);
    const result = await pool.query(
      `SELECT vs.id, vs.name AS text FROM virtual_servers vs WHERE ${w} ORDER BY vs.name LIMIT 20`, w.params);
    return result.rows;
  }
}

export default ServiceMapping;
