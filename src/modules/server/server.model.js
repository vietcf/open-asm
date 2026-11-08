import { pool } from '../../../config/config.js';
import { db, Where, NONE, replaceLinks, replaceTags, subList, searchRank, matchOrder } from '../../shared/db.js';

// Server with platform and every link. ip_addresses carry role ('normal' or 'vip').
// One subquery per list (no join fan-out, no GROUP BY).
const SELECT_WITH_LINKS = `
  SELECT s.*, p.name AS platform_name, p.description AS os_description,
    ${subList({ id: 'ip.id', ip_address: 'ip.ip_address', description: 'ip.description', status: 'ip.status', role: 'svi.role' },
      'FROM server_ip svi JOIN ip_addresses ip ON ip.id = svi.ip_id WHERE svi.server_id = s.id', 'ip.id')} AS ip_addresses,
    ${subList({ id: 't.id', name: 't.name', description: 't.description' },
      "FROM tag_object tobj JOIN tags t ON t.id = tobj.tag_id WHERE tobj.object_type = 'server' AND tobj.object_id = s.id", 't.id')} AS tags,
    ${subList({ id: 'c.id', name: 'c.name', email: 'c.email', phone: 'c.phone' },
      'FROM server_contact sc JOIN contacts c ON c.id = sc.contact_id WHERE sc.server_id = s.id', 'c.id')} AS managers,
    ${subList({ id: 'sys.id', name: 'sys.name', system_id: 'sys.system_id' },
      'FROM server_system ss JOIN systems sys ON sys.id = ss.system_id WHERE ss.server_id = s.id', 'sys.id')} AS systems,
    ${subList({ id: 'sv.id', name: 'sv.name', description: 'sv.description' },
      'FROM server_services sss JOIN services sv ON sv.id = sss.service_id WHERE sss.server_id = s.id', 'sv.id')} AS services,
    ${subList({ id: 'ag.id', name: 'ag.name', version: 'ag.version', description: 'ag.description' },
      'FROM server_agents sa JOIN agents ag ON ag.id = sa.agent_id WHERE sa.server_id = s.id', 'ag.id')} AS agents
  FROM servers s
  LEFT JOIN platforms p ON p.id = s.os_id`;

// REST detail shape: os as an object
function withOs(row) {
  if (!row) return null;
  const { platform_name, os_description, ...server } = row;
  if (platform_name) server.os = { id: row.os_id, name: platform_name, description: os_description };
  return server;
}

// filter: {search, status, type, location, os[], tags[], ip[], manager[], systems[], services[]}; NONE = not set
function filterWhere({ search = '', status = '', type = '', location = '', os = [], tags = [], ip = [], manager = [], systems = [], services = [] }) {
  const w = new Where();
  w.search(search, ['s.name ILIKE ?', 's.description ILIKE ?', 's.os_version ILIKE ?',
    'EXISTS (SELECT 1 FROM server_ip x JOIN ip_addresses i ON i.id = x.ip_id WHERE x.server_id = s.id AND i.ip_address::text ILIKE ?)']);
  if (status) w.add(`s.status = ${w.param(status)}`);
  if (type === NONE) w.add("(s.type IS NULL OR s.type = '')");
  else if (type) w.add(`s.type = ${w.param(type)}`);
  if (location === NONE) w.add("(s.location IS NULL OR s.location = '')");
  else if (location) w.add(`s.location ILIKE ${w.param(location)}`);
  w.anyOf(os, (ids) => `s.os_id = ANY(${w.param(ids.map(Number))})`, 's.os_id IS NULL');
  if (tags.length) w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'server' AND x.object_id = s.id AND x.tag_id = ANY(${w.param(tags.map(Number))}))`);
  if (ip.length) w.add(`EXISTS (SELECT 1 FROM server_ip x WHERE x.server_id = s.id AND x.ip_id = ANY(${w.param(ip.map(Number))}))`);
  w.anyOf(manager, (ids) => `EXISTS (SELECT 1 FROM server_contact x WHERE x.server_id = s.id AND x.contact_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM server_contact x WHERE x.server_id = s.id)');
  w.anyOf(systems, (ids) => `EXISTS (SELECT 1 FROM server_system x WHERE x.server_id = s.id AND x.system_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM server_system x WHERE x.server_id = s.id)');
  if (services.length) w.add(`EXISTS (SELECT 1 FROM server_services x WHERE x.server_id = s.id AND x.service_id = ANY(${w.param(services.map(Number))}))`);
  return w;
}

class Server {
  static async create({ name, os, os_version, status, location, type, description, username }, client) {
    const res = await db(client).query(
      'INSERT INTO servers (name, os_id, status, location, type, description, updated_by, os_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [name, os || null, status || null, location || null, type || null, description || null, username, os_version || null]
    );
    return res.rows[0].id;
  }

  static async update(id, { name, os, os_version, status, location, type, description, username }, client) {
    await db(client).query(
      'UPDATE servers SET name = $1, os_id = $2, status = $3, location = $4, type = $5, description = $6, updated_at = NOW(), updated_by = $7, os_version = $9 WHERE id = $8',
      [name, os || null, status || null, location || null, type || null, description || null, username, id, os_version || null]
    );
  }

  // Links go with the server (server_ip cascades); its IPs are handled by the caller.
  static async remove(id, client) {
    const ex = db(client);
    for (const table of ['server_contact', 'server_system', 'server_agents', 'server_services']) {
      await ex.query(`DELETE FROM ${table} WHERE server_id = $1`, [id]);
    }
    await replaceTags(ex, 'server', id, []);
    await ex.query('DELETE FROM servers WHERE id = $1', [id]);
  }

  static async findById(id, client) {
    const res = await db(client).query(`${SELECT_WITH_LINKS} WHERE s.id = $1`, [id]);
    return res.rows[0] || null;
  }

  // REST shape (os object)
  static async findByIdWithDetails(id, client) {
    return withOs(await Server.findById(id, client));
  }

  // REST /servers/find: exact name and/or IP address
  static async findByCriteria({ name, ip_address }) {
    const w = new Where();
    if (name) w.add(`s.name = ${w.param(name)}`);
    if (ip_address) w.add(`EXISTS (SELECT 1 FROM server_ip x JOIN ip_addresses i ON i.id = x.ip_id WHERE x.server_id = s.id AND i.ip_address = ${w.param(ip_address)})`);
    if (!w.clauses.length) return [];
    const res = await pool.query(`${SELECT_WITH_LINKS} WHERE ${w} ORDER BY s.updated_at DESC`, w.params);
    return res.rows.map(withOs);
  }

  // OS versions already recorded (form suggestions)
  static async distinctOsVersions() {
    const res = await pool.query("SELECT DISTINCT os_version FROM servers WHERE COALESCE(TRIM(os_version), '') <> '' ORDER BY os_version");
    return res.rows.map((r) => r.os_version);
  }

  static async findByName(name) {
    const res = await pool.query('SELECT id, name FROM servers WHERE LOWER(name) = LOWER($1)', [name]);
    return res.rows[0] || null;
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM servers WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const res = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ORDER BY ${searchRank((p) => ['s.name',
        `(SELECT i.ip_address FROM server_ip x JOIN ip_addresses i ON i.id = x.ip_id WHERE x.server_id = s.id AND i.ip_address = ${p} LIMIT 1)`], filter.search, w)}s.updated_at DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return res.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const res = await pool.query(`SELECT COUNT(*) FROM servers s WHERE ${w}`, w.params);
    return parseInt(res.rows[0].count, 10);
  }

  // Select2 lookup: [{id, text}]
  static async select2Search({ search = '', limit = 20 }) {
    const res = await pool.query(`SELECT id, name AS text FROM servers WHERE name ILIKE $1 ORDER BY ${matchOrder('name', '$3')} LIMIT $2`, [`%${search}%`, limit, search]);
    return res.rows;
  }

  // ===== Links (IPs: see network/ip-ownership.js) =====
  static setManagers(id, ids, client) { return replaceLinks(client, 'server_contact', 'server_id', id, 'contact_id', ids); }
  static setSystems(id, ids, client) { return replaceLinks(client, 'server_system', 'server_id', id, 'system_id', ids); }
  static setAgents(id, ids, client) { return replaceLinks(client, 'server_agents', 'server_id', id, 'agent_id', ids); }
  static setServices(id, ids, client) { return replaceLinks(client, 'server_services', 'server_id', id, 'service_id', ids); }
  static setTags(id, ids, client) { return replaceTags(client, 'server', id, ids); }
}

export default Server;
