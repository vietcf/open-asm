import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, replaceTags, jsonList } from '../../shared/db.js';

// IP with links, owners (devices/servers with role 'normal' or 'vip') and the
// most specific subnet containing it.
const SELECT_WITH_LINKS = `
  SELECT ip.*,
    ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags,
    ${jsonList('c', { id: 'c.id', name: 'c.name', email: 'c.email', phone: 'c.phone' })} AS contacts,
    ${jsonList('s', { id: 's.id', name: 's.name', system_id: 's.system_id' })} AS systems,
    ${jsonList('d', { id: 'd.id', name: 'd.name', role: 'di.role' })} AS devices,
    ${jsonList('srv', { id: 'srv.id', name: 'srv.name', role: 'svi.role' })} AS servers,
    sn.subnet
  FROM ip_addresses ip
  LEFT JOIN tag_object tobj ON tobj.object_type = 'ip_address' AND tobj.object_id = ip.id
  LEFT JOIN tags t ON t.id = tobj.tag_id
  LEFT JOIN ip_contact ic ON ic.ip_id = ip.id
  LEFT JOIN contacts c ON c.id = ic.contact_id
  LEFT JOIN system_ip si ON si.ip_id = ip.id
  LEFT JOIN systems s ON s.id = si.system_id
  LEFT JOIN device_ip di ON di.ip_id = ip.id
  LEFT JOIN devices d ON d.id = di.device_id
  LEFT JOIN server_ip svi ON svi.ip_id = ip.id
  LEFT JOIN servers srv ON srv.id = svi.server_id
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object('id', x.id, 'address', x.address, 'description', x.description, 'zone', x.zone,
      'environment', x.environment, 'prefix_length', masklen(x.address)) AS subnet
    FROM subnets x WHERE x.address >>= ip.ip_address::inet ORDER BY masklen(x.address) DESC LIMIT 1
  ) sn ON TRUE`;
const GROUP_BY = 'GROUP BY ip.id, sn.subnet';

// device / server = primary owner (legacy single-owner fields kept for the API)
function withOwners(row) {
  if (!row) return null;
  row.device = row.devices.find((o) => o.role === 'normal') || row.devices[0] || null;
  row.server = row.servers.find((o) => o.role === 'normal') || row.servers[0] || null;
  row.device_name = row.device?.name || null;
  row.server_name = row.server?.name || null;
  return row;
}

// filter: {search, status[], tags[], systems[], contacts[], zone, environment, subnet_id}
// status / systems / contacts accept NONE ("not set").
function filterWhere({ search = '', status = [], tags = [], systems = [], contacts = [], zone, environment, subnet_id }) {
  const w = new Where();
  w.search(search, ['ip.ip_address ILIKE ?', 'ip.description ILIKE ?',
    "EXISTS (SELECT 1 FROM tag_object x JOIN tags tg ON tg.id = x.tag_id WHERE x.object_type = 'ip_address' AND x.object_id = ip.id AND tg.name ILIKE ?)",
    'EXISTS (SELECT 1 FROM ip_contact x JOIN contacts ct ON ct.id = x.contact_id WHERE x.ip_id = ip.id AND (ct.name ILIKE ? OR ct.email ILIKE ?))',
    'EXISTS (SELECT 1 FROM system_ip x JOIN systems sy ON sy.id = x.system_id WHERE x.ip_id = ip.id AND sy.name ILIKE ?)']);
  w.anyOf([].concat(status).filter(Boolean), (v) => `ip.status = ANY(${w.param(v)})`, 'ip.status IS NULL');
  if (tags.length) w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'ip_address' AND x.object_id = ip.id AND x.tag_id = ANY(${w.param(tags.map(Number))}))`);
  w.anyOf(systems, (ids) => `EXISTS (SELECT 1 FROM system_ip x WHERE x.ip_id = ip.id AND x.system_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM system_ip x WHERE x.ip_id = ip.id)');
  w.anyOf(contacts, (ids) => `EXISTS (SELECT 1 FROM ip_contact x WHERE x.ip_id = ip.id AND x.contact_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM ip_contact x WHERE x.ip_id = ip.id)');
  const inSubnet = (col, value) => `EXISTS (SELECT 1 FROM subnets x WHERE x.address >>= ip.ip_address::inet AND x.${col} = ${w.param(value)})`;
  if (zone) w.add(inSubnet('zone', zone));
  if (environment) w.add(inSubnet('environment', environment));
  if (subnet_id) w.add(`ip.ip_address::inet <<= (SELECT address FROM subnets WHERE id = ${w.param(Number(subnet_id))})`);
  return w;
}

class IpAddress {
  static async create({ address, description, status, updated_by }, client) {
    const result = await db(client).query(
      'INSERT INTO ip_addresses (ip_address, description, status, updated_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [address, description ?? null, status ?? null, updated_by ?? null]
    );
    return result.rows[0];
  }

  static async update(id, { description, status, updated_by }, client) {
    const result = await db(client).query(
      'UPDATE ip_addresses SET description = $1, status = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4 RETURNING *',
      [description ?? null, status ?? null, updated_by ?? null, id]
    );
    return result.rows[0];
  }

  // Link tables cascade; tags are polymorphic. Owners are checked by the service.
  static async remove(id, client) {
    await replaceTags(client, 'ip_address', id, []);
    await db(client).query('DELETE FROM ip_addresses WHERE id = $1', [id]);
  }

  static async findById(id, client) {
    const result = await db(client).query('SELECT * FROM ip_addresses WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByAddress(address) {
    const result = await pool.query('SELECT * FROM ip_addresses WHERE ip_address = $1', [address]);
    return result.rows[0] || null;
  }

  static async findByIds(ids) {
    const result = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE id = ANY($1::int[]) ORDER BY ip_address', [ids]);
    return result.rows;
  }

  static async findByIdWithDetails(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE ip.id = $1 ${GROUP_BY}`, [id]);
    return withOwners(result.rows[0]);
  }

  static async findByAddressWithDetails(address) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE ip.ip_address = $1 ${GROUP_BY}`, [address]);
    return withOwners(result.rows[0]);
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM ip_addresses WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY ip.updated_at DESC, ip.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows.map(withOwners);
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM ip_addresses ip WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // IPs inside a subnet, with tags and primary owner
  static async findInSubnet(subnetAddress) {
    const result = await pool.query(`
      SELECT ip.id, ip.ip_address, ip.description, ip.status, ip.ip_type,
        (SELECT srv.name FROM server_ip x JOIN servers srv ON srv.id = x.server_id WHERE x.ip_id = ip.id AND x.role = 'normal' LIMIT 1) AS server_name,
        (SELECT d.name FROM device_ip x JOIN devices d ON d.id = x.device_id WHERE x.ip_id = ip.id AND x.role = 'normal' LIMIT 1) AS device_name,
        COALESCE((SELECT json_agg(t.name ORDER BY t.name) FROM tag_object x JOIN tags t ON t.id = x.tag_id
          WHERE x.object_type = 'ip_address' AND x.object_id = ip.id), '[]') AS tags
      FROM ip_addresses ip
      WHERE ip.ip_address::inet <<= $1::inet
      ORDER BY ip.ip_address::inet`, [subnetAddress]);
    return result.rows;
  }

  // ===== Select2 lookups: [{id, ip_address, owner_label?}] =====
  static async search(search = '', limit = 20) {
    const result = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE ip_address ILIKE $1 ORDER BY ip_address LIMIT $2', [`%${search}%`, limit]);
    return result.rows;
  }

  static async findUnassignIP({ search = '', limit = 20 }) {
    const result = await pool.query(
      "SELECT id, ip_address FROM ip_addresses WHERE (status IS NULL OR status <> 'assigned') AND ip_address ILIKE $1 ORDER BY ip_address LIMIT $2",
      [`%${search}%`, limit]
    );
    return result.rows;
  }

  // Assigned or not (VIP picker, subnet gateway picker). subnet: a validated CIDR.
  static async searchAllForVip({ search = '', excludeDeviceId, excludeServerId, subnet, limit = 20 }) {
    const w = new Where();
    w.add(`ip.ip_address ILIKE ${w.param(`%${search}%`)}`);
    if (excludeDeviceId) w.add(`NOT EXISTS (SELECT 1 FROM device_ip WHERE ip_id = ip.id AND device_id = ${w.param(excludeDeviceId)})`);
    if (excludeServerId) w.add(`NOT EXISTS (SELECT 1 FROM server_ip WHERE ip_id = ip.id AND server_id = ${w.param(excludeServerId)})`);
    if (subnet) w.add(`ip.ip_address::inet <<= ${w.param(subnet)}::cidr`);
    const result = await pool.query(`
      SELECT ip.id, ip.ip_address, COALESCE(
        (SELECT d.name FROM device_ip di JOIN devices d ON d.id = di.device_id WHERE di.ip_id = ip.id AND di.role = 'normal' LIMIT 1),
        (SELECT srv.name FROM server_ip sv JOIN servers srv ON srv.id = sv.server_id WHERE sv.ip_id = ip.id AND sv.role = 'normal' LIMIT 1)
      ) AS owner_label
      FROM ip_addresses ip WHERE ${w} ORDER BY ip.ip_address LIMIT ${w.param(limit)}`, w.params);
    return result.rows;
  }

  // ===== Links =====
  static setTags(id, ids, client) { return replaceTags(client, 'ip_address', id, ids); }
  static setContacts(id, ids, client) { return replaceLinks(client, 'ip_contact', 'ip_id', id, 'contact_id', ids); }
  static setSystems(id, ids, client) { return replaceLinks(client, 'system_ip', 'ip_id', id, 'system_id', ids); }

  // ===== Owners (devices / servers; see ip-ownership.js) =====
  static async getOwners(ipId, client) {
    const ex = db(client);
    const [devices, servers] = await Promise.all([
      ex.query("SELECT d.id, d.name, di.role FROM device_ip di JOIN devices d ON d.id = di.device_id WHERE di.ip_id = $1 ORDER BY di.role = 'normal' DESC, d.name", [ipId]),
      ex.query("SELECT srv.id, srv.name, sv.role FROM server_ip sv JOIN servers srv ON srv.id = sv.server_id WHERE sv.ip_id = $1 ORDER BY sv.role = 'normal' DESC, srv.name", [ipId]),
    ]);
    return { devices: devices.rows, servers: servers.rows };
  }

  static async getPrimaryOwnerIds(ipId, client) {
    const ex = db(client);
    const [d, s] = await Promise.all([
      ex.query("SELECT device_id FROM device_ip WHERE ip_id = $1 AND role = 'normal' LIMIT 1", [ipId]),
      ex.query("SELECT server_id FROM server_ip WHERE ip_id = $1 AND role = 'normal' LIMIT 1", [ipId]),
    ]);
    return { deviceId: d.rows[0]?.device_id ?? null, serverId: s.rows[0]?.server_id ?? null };
  }

  // ip_type is derived: 'vip' when more than one device/server links the IP
  static async recomputeIpType(ipId, client) {
    await db(client).query(`
      UPDATE ip_addresses SET ip_type = CASE WHEN (
        (SELECT COUNT(*) FROM device_ip WHERE ip_id = $1) + (SELECT COUNT(*) FROM server_ip WHERE ip_id = $1)
      ) > 1 THEN 'vip' ELSE 'physical' END
      WHERE id = $1`, [ipId]);
  }

  // Secondary ('vip') link to a device or a server
  static async addVipLink({ ip_id, device_id, server_id, updated_by }, client) {
    const ex = db(client);
    if (device_id) await ex.query("INSERT INTO device_ip (device_id, ip_id, role, updated_by) VALUES ($1, $2, 'vip', $3) ON CONFLICT (device_id, ip_id) DO NOTHING", [device_id, ip_id, updated_by]);
    if (server_id) await ex.query("INSERT INTO server_ip (server_id, ip_id, role, updated_by) VALUES ($1, $2, 'vip', $3) ON CONFLICT (server_id, ip_id) DO NOTHING", [server_id, ip_id, updated_by]);
    await IpAddress.recomputeIpType(ip_id, ex);
  }

  static async removeVipLink({ ip_id, device_id, server_id }, client) {
    const ex = db(client);
    if (device_id) await ex.query('DELETE FROM device_ip WHERE device_id = $1 AND ip_id = $2', [device_id, ip_id]);
    if (server_id) await ex.query('DELETE FROM server_ip WHERE server_id = $1 AND ip_id = $2', [server_id, ip_id]);
    await IpAddress.recomputeIpType(ip_id, ex);
  }
}

export default IpAddress;
