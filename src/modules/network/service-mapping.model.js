import { pool } from '../../../config/config.js';
import { db, Where, jsonList, subList, matchOrder, matchRank } from '../../shared/db.js';

const COLUMNS = ['name', 'domain_id', 'provider', 'provider_port', 'provider_protocol', 'ip_address_id', 'port', 'protocol', 'direction', 'scope',
  'access_mode', 'system_id', 'description', 'updated_by'];

// Flows (direction x scope, see migrations 0033 / 0034): our IP (ip_address_id:
// public / NAT service / NAT / egress IP, on its FW / LB device), partner IPs
// (allowed sources, or the outbound destinations with their own port, protocol
// and, for internet connectivity, domain) and members (backends, or outbound
// sources without port).
// Asset mapping: every IP of the flow names the device, else the server,
// holding it in the inventory (ip_owner_*, members[].owner_*, partner_ips[].owner_*);
// none for an IP nothing holds. Members' server_name lists the server(s) owning the IP.
const IP_OWNER = (ipId) => `
    SELECT * FROM (
      SELECT d.id, d.name, 'device' AS kind, (di.role <> 'normal')::int AS rank FROM device_ip di JOIN devices d ON d.id = di.device_id WHERE di.ip_id = ${ipId}
      UNION ALL
      SELECT s.id, s.name, 'server', 2 + (si.role <> 'normal')::int FROM server_ip si JOIN servers s ON s.id = si.server_id WHERE si.ip_id = ${ipId}
    ) o ORDER BY rank, id LIMIT 1`;
const SELECT_WITH_LINKS = `
  SELECT vs.*, fip.ip_address, dom.domain,
    own.name AS ip_owner_name, own.kind AS ip_owner_type, own.id AS ip_owner_id, sys.name AS system_name,
    ${subList({ id: 'p.id', address: 'p.address', partner: 'p.partner', port: 'p.port', protocol: 'p.protocol', domain: 'p.domain', owner_name: 'po.name', owner_type: 'po.kind' },
      `FROM virtual_server_partner_ips p
       LEFT JOIN LATERAL (${IP_OWNER("(SELECT x.id FROM ip_addresses x WHERE x.ip_address = p.address LIMIT 1)")}) po ON TRUE
       WHERE p.virtual_server_id = vs.id`, 'p.position')} AS partner_ips,
    ${jsonList('m', {
      id: 'm.id', ip_address_id: 'ip.id', ip: 'ip.ip_address', port: 'm.port', protocol: 'm.protocol', status: 'm.status',
      server_name: "(SELECT string_agg(s.name, ', ' ORDER BY s.name) FROM server_ip si JOIN servers s ON s.id = si.server_id WHERE si.ip_id = ip.id)",
      owner_name: 'mo.name', owner_type: 'mo.kind',
    })} AS members
  FROM virtual_servers vs
  LEFT JOIN ip_addresses fip ON fip.id = vs.ip_address_id
  LEFT JOIN domains dom ON dom.id = vs.domain_id
  LEFT JOIN LATERAL (${IP_OWNER('vs.ip_address_id')}) own ON TRUE
  LEFT JOIN systems sys ON sys.id = vs.system_id
  LEFT JOIN virtual_server_members m ON m.virtual_server_id = vs.id
  LEFT JOIN ip_addresses ip ON ip.id = m.ip_address_id
  LEFT JOIN LATERAL (${IP_OWNER('ip.id')}) mo ON TRUE`;
const GROUP_BY = 'GROUP BY vs.id, fip.ip_address, dom.domain, own.id, own.name, own.kind, sys.name';

function filterWhere({ search = '', protocol, provider, device_id, system_id, direction, scope, access_mode, partner }) {
  const w = new Where();
  w.search(search, [
    'vs.name ILIKE ?', 'vs.provider ILIKE ?',
    'EXISTS (SELECT 1 FROM domains x WHERE x.id = vs.domain_id AND x.domain ILIKE ?)',
    'EXISTS (SELECT 1 FROM ip_addresses x WHERE x.id = vs.ip_address_id AND x.ip_address ILIKE ?)',
    'EXISTS (SELECT 1 FROM device_ip x JOIN devices d ON d.id = x.device_id WHERE x.ip_id = vs.ip_address_id AND d.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM server_ip x JOIN servers s ON s.id = x.server_id WHERE x.ip_id = vs.ip_address_id AND s.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM systems x WHERE x.id = vs.system_id AND x.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM virtual_server_members x JOIN ip_addresses i ON i.id = x.ip_address_id WHERE x.virtual_server_id = vs.id AND i.ip_address ILIKE ?)',
    'EXISTS (SELECT 1 FROM virtual_server_members x JOIN server_ip si ON si.ip_id = x.ip_address_id JOIN servers s ON s.id = si.server_id WHERE x.virtual_server_id = vs.id AND s.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM virtual_server_partner_ips x WHERE x.virtual_server_id = vs.id AND (x.address ILIKE ? OR x.partner ILIKE ? OR x.domain ILIKE ?))',
  ]);
  if (partner) w.add(`EXISTS (SELECT 1 FROM virtual_server_partner_ips x WHERE x.virtual_server_id = vs.id AND x.partner = ${w.param(partner)})`);
  if (protocol) w.add(`vs.protocol = ${w.param(protocol)}`);
  if (provider) w.add(`vs.provider = ${w.param(provider)}`);
  // device_id: mappings whose frontend IP the device holds
  if (device_id) w.add(`EXISTS (SELECT 1 FROM device_ip x WHERE x.ip_id = vs.ip_address_id AND x.device_id = ${w.param(Number(device_id))})`);
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

  static async findById(id, client) {
    const result = await db(client).query('SELECT * FROM virtual_servers WHERE id = $1', [id]);
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
    // searching: exact name / domain / frontend IP matches first, then starts with, then the rest
    const search = String(filter.search || '').trim();
    const rank = search ? `${matchRank(['vs.name', "COALESCE(fip.ip_address, '')", "COALESCE(dom.domain, '')"], w.param(search))}, ` : '';
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY ${rank}vs.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params);
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM virtual_servers vs WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Mappings whose frontend IP the device holds (Device detail page)
  static async findByDeviceId(deviceId) {
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE EXISTS (SELECT 1 FROM device_ip x WHERE x.ip_id = vs.ip_address_id AND x.device_id = $1) ${GROUP_BY} ORDER BY vs.id DESC`, [deviceId]);
    return result.rows;
  }

  // Virtual servers whose members include one of a server's IPs (Server detail page)
  static async findByServerId(serverId) {
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE EXISTS (SELECT 1 FROM virtual_server_members x JOIN server_ip si ON si.ip_id = x.ip_address_id WHERE x.virtual_server_id = vs.id AND si.server_id = $1) ${GROUP_BY} ORDER BY vs.id DESC`,
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

  // Partner names already used (filter of the list)
  static async getDistinctPartners() {
    const result = await pool.query("SELECT DISTINCT partner FROM virtual_server_partner_ips WHERE COALESCE(partner, '') <> '' ORDER BY partner");
    return result.rows.map((r) => r.partner);
  }

  // ===== Links =====
  // rows: [{address, partner, port, protocol, domain}] in their order
  static async setPartnerIps(vsId, rows, client) {
    const ex = db(client);
    await ex.query('DELETE FROM virtual_server_partner_ips WHERE virtual_server_id = $1', [vsId]);
    for (const [i, r] of (rows || []).entries()) {
      await ex.query('INSERT INTO virtual_server_partner_ips (virtual_server_id, address, partner, port, protocol, domain, position) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [vsId, r.address, r.partner || null, r.port || null, r.protocol || null, r.domain || null, i]);
    }
  }

  static async setMembers(vsId, members, client) {
    const ex = db(client);
    await ex.query('DELETE FROM virtual_server_members WHERE virtual_server_id = $1', [vsId]);
    for (const m of members || []) {
      await ex.query(
        'INSERT INTO virtual_server_members (virtual_server_id, ip_address_id, port, protocol, status) VALUES ($1, $2, $3, $4, $5)',
        [vsId, m.ip_address_id, m.port || null, m.protocol || null, m.status || 'active']);
    }
  }

  // Select2 search
  static async select2Search(search) {
    const w = new Where();
    w.search(search, ['vs.name ILIKE ?', 'dom.domain ILIKE ?', 'fip.ip_address ILIKE ?']);
    const result = await pool.query(
      `SELECT vs.id, vs.name AS text FROM virtual_servers vs
         LEFT JOIN ip_addresses fip ON fip.id = vs.ip_address_id LEFT JOIN domains dom ON dom.id = vs.domain_id
        WHERE ${w} ORDER BY ${matchOrder(['vs.name', "COALESCE(fip.ip_address, '')", "COALESCE(dom.domain, '')"], w.param(String(search || '').trim()))} LIMIT 20`, w.params);
    return result.rows;
  }
}

export default ServiceMapping;
