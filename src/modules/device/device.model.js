import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, replaceTags, subList } from '../../shared/db.js';

const COLUMNS = ['name', 'manufacturer', 'device_role', 'platform_id', 'device_type_id', 'location', 'serial_number', 'management_address', 'description', 'updated_by'];

// Device with type, platform and links. ip_addresses carry role ('normal' or 'vip').
// One subquery per list (no join fan-out, no GROUP BY).
const SELECT_WITH_LINKS = `
  SELECT d.*, dt.name AS device_type_name, p.name AS platform_name,
    ${subList({ id: 'ip.id', ip_address: 'ip.ip_address', description: 'ip.description', status: 'ip.status', role: 'di.role' },
      'FROM device_ip di JOIN ip_addresses ip ON ip.id = di.ip_id WHERE di.device_id = d.id', 'ip.id')} AS ip_addresses,
    ${subList({ id: 't.id', name: 't.name', description: 't.description' },
      "FROM tag_object tobj JOIN tags t ON t.id = tobj.tag_id WHERE tobj.object_type = 'device' AND tobj.object_id = d.id", 't.id')} AS tags,
    ${subList({ id: 'c.id', name: 'c.name', email: 'c.email', phone: 'c.phone' },
      'FROM device_contact dc JOIN contacts c ON c.id = dc.contact_id WHERE dc.device_id = d.id', 'c.id')} AS contacts
  FROM devices d
  LEFT JOIN device_types dt ON d.device_type_id = dt.id
  LEFT JOIN platforms p ON d.platform_id = p.id`;

// filter: {search, device_type_id, platform_id, location, manufacturer, device_role, tags[]}
function filterWhere({ search = '', device_type_id, platform_id, location, manufacturer, device_role, tags = [] }) {
  const w = new Where();
  w.search(search, ['d.name ILIKE ?', 'd.manufacturer ILIKE ?', 'd.device_role ILIKE ?', 'd.management_address ILIKE ?', 'd.serial_number ILIKE ?',
    'EXISTS (SELECT 1 FROM platforms x WHERE x.id = d.platform_id AND x.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM device_types x WHERE x.id = d.device_type_id AND x.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM device_ip x JOIN ip_addresses i ON i.id = x.ip_id WHERE x.device_id = d.id AND i.ip_address ILIKE ?)',
    "EXISTS (SELECT 1 FROM tag_object x JOIN tags tg ON tg.id = x.tag_id WHERE x.object_type = 'device' AND x.object_id = d.id AND tg.name ILIKE ?)"]);
  if (device_type_id) w.add(`d.device_type_id = ${w.param(Number(device_type_id))}`);
  if (platform_id) w.add(`d.platform_id = ${w.param(Number(platform_id))}`);
  if (location) w.add(`d.location ILIKE ${w.param(location)}`);
  if (manufacturer) w.add(`d.manufacturer ILIKE ${w.param(manufacturer)}`);
  if (device_role) w.add(`d.device_role ILIKE ${w.param(device_role)}`);
  if (tags.length) w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'device' AND x.object_id = d.id AND x.tag_id = ANY(${w.param(tags.map(Number))}))`);
  return w;
}

class Device {
  static async create(data, client) {
    const result = await db(client).query(
      `INSERT INTO devices (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      COLUMNS.map((c) => data[c] ?? null)
    );
    return result.rows[0];
  }

  // Only the given columns change
  static async updatePartial(id, data, client) {
    const keys = COLUMNS.filter((c) => data[c] !== undefined);
    if (!keys.length) return null;
    const result = await db(client).query(
      `UPDATE devices SET ${keys.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((c) => data[c]), id]
    );
    return result.rows[0];
  }

  // Links go with the device (device_ip cascades); its IPs are handled by the caller.
  static async remove(id, client) {
    const ex = db(client);
    await ex.query('DELETE FROM device_contact WHERE device_id = $1', [id]);
    await replaceTags(ex, 'device', id, []);
    await ex.query('DELETE FROM devices WHERE id = $1', [id]);
  }

  static async getFullDetail(id, client) {
    const result = await db(client).query(`${SELECT_WITH_LINKS} WHERE d.id = $1`, [id]);
    return result.rows[0] || null;
  }

  // REST /devices/find: exact name and/or IP address
  static async findByCriteria({ name, ip_address }) {
    const w = new Where();
    if (name) w.add(`d.name = ${w.param(name)}`);
    if (ip_address) w.add(`EXISTS (SELECT 1 FROM device_ip x JOIN ip_addresses i ON i.id = x.ip_id WHERE x.device_id = d.id AND i.ip_address = ${w.param(ip_address)})`);
    if (!w.clauses.length) return [];
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE ${w} ORDER BY d.updated_at DESC, d.id DESC`, w.params);
    return result.rows;
  }

  static async findByName(name) {
    const result = await pool.query('SELECT * FROM devices WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM devices WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ORDER BY d.updated_at DESC, d.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM devices d WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Distinct non-empty values of a free-text column (manufacturer, device_role) for autocomplete
  static async distinctValues(column, search = '', limit = 20) {
    if (!['manufacturer', 'device_role'].includes(column)) throw new Error(`Unsupported column: ${column}`);
    const result = await pool.query(
      `SELECT DISTINCT ${column} AS value FROM devices WHERE ${column} <> '' AND ${column} ILIKE $1 ORDER BY 1 LIMIT $2`,
      [`%${search}%`, limit]
    );
    return result.rows.map((r) => r.value);
  }

  // Select2 lookup: [{id, text}]
  static async select2Search(search = '', limit = 20) {
    const result = await pool.query('SELECT id, name AS text FROM devices WHERE name ILIKE $1 ORDER BY name LIMIT $2', [`%${search}%`, limit]);
    return result.rows;
  }

  // ===== Links (IPs: see network/ip-ownership.js) =====
  static setTags(id, ids, client) { return replaceTags(client, 'device', id, ids); }
  static setContacts(id, ids, client) { return replaceLinks(client, 'device_contact', 'device_id', id, 'contact_id', ids); }
}

export default Device;
