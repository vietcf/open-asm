import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, replaceTags, jsonList, searchRank, matchOrder } from '../../shared/db.js';

const COLUMNS = ['system_id', 'name', 'description', 'app_type', 'fqdn', 'updated_by'];
const toRow = (data) => COLUMNS.map((col) => data[col] ?? null);

function filterWhere({ search = '', filterTags = [], filterContacts = [], system_id = null, app_type = null }) {
  const w = new Where();
  w.search(search, [
    'sc.name ILIKE ?', 'sc.description ILIKE ?', 'sc.app_type ILIKE ?',
    'EXISTS (SELECT 1 FROM unnest(sc.fqdn) f WHERE f ILIKE ?)',
    'EXISTS (SELECT 1 FROM system_component_ip x JOIN ip_addresses ip ON ip.id = x.ip_id WHERE x.component_id = sc.id AND ip.ip_address::text ILIKE ?)',
  ]);
  if (filterTags.length) {
    w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'component' AND x.object_id = sc.id AND x.tag_id = ANY(${w.param(filterTags.map(Number))}))`);
  }
  w.anyOf(filterContacts,
    (ids) => `EXISTS (SELECT 1 FROM system_component_contact x WHERE x.component_id = sc.id AND x.contact_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM system_component_contact x WHERE x.component_id = sc.id)');
  const systems = [].concat(system_id ?? []).filter((v) => v !== '').map(Number);
  if (systems.length) w.add(`sc.system_id = ANY(${w.param(systems)})`);
  w.anyOf([].concat(app_type ?? []).filter((v) => v !== ''),
    (types) => `sc.app_type = ANY(${w.param(types)})`,
    "(sc.app_type IS NULL OR sc.app_type = '')");
  return w;
}

// Components with system name, tags, contacts and IPs
const SELECT_WITH_RELATIONS = `
  SELECT sc.*,
    s.name AS system_name,
    ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags,
    ${jsonList('c', { id: 'c.id', name: 'c.name', email: 'c.email' })} AS contacts,
    ${jsonList('ip', { id: 'ip.id', ip: 'ip.ip_address', server_name: 'srv.name', subnet_zone: 'sub.zone', subnet_environment: 'sub.environment' })} AS ips
  FROM system_components sc
  LEFT JOIN systems s ON sc.system_id = s.id
  LEFT JOIN tag_object tobj ON tobj.object_type = 'component' AND tobj.object_id = sc.id
  LEFT JOIN tags t ON t.id = tobj.tag_id
  LEFT JOIN system_component_contact scc ON scc.component_id = sc.id
  LEFT JOIN contacts c ON c.id = scc.contact_id
  LEFT JOIN system_component_ip sci ON sci.component_id = sc.id
  LEFT JOIN ip_addresses ip ON ip.id = sci.ip_id
  LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
  LEFT JOIN servers srv ON srv.id = svi.server_id
  LEFT JOIN LATERAL (
    SELECT zone, environment FROM subnets sub
    WHERE sub.address >>= ip.ip_address::inet
    ORDER BY masklen(sub.address) DESC LIMIT 1
  ) sub ON true`;

class SystemComponent {
  static async create(data, client) {
    const result = await db(client).query(
      `INSERT INTO system_components (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      toRow(data)
    );
    return result.rows[0];
  }

  static async update(id, data, client) {
    const result = await db(client).query(
      `UPDATE system_components SET ${COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${COLUMNS.length + 1} RETURNING *`,
      [...toRow(data), id]
    );
    return result.rows[0];
  }

  static async delete(id, client) {
    await db(client).query('DELETE FROM system_components WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT sc.*, s.name AS system_name FROM system_components sc LEFT JOIN systems s ON sc.system_id = s.id WHERE sc.id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByIdWithRelations(id) {
    const result = await pool.query(`${SELECT_WITH_RELATIONS} WHERE sc.id = $1 GROUP BY sc.id, s.name`, [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM system_components WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Names are unique per system (case-insensitive)
  static async existsByName(systemId, name, excludeId = null) {
    const result = await pool.query(
      'SELECT 1 FROM system_components WHERE system_id = $1 AND LOWER(name) = LOWER($2) AND ($3::int IS NULL OR id <> $3)',
      [systemId, name, excludeId]
    );
    return result.rowCount > 0;
  }

  static async countBySystemId(systemId, client) {
    const result = await db(client).query('SELECT COUNT(*) FROM system_components WHERE system_id = $1', [systemId]);
    return parseInt(result.rows[0].count, 10);
  }

  // ===== Links =====
  static setContacts(id, ids, client) { return replaceLinks(client, 'system_component_contact', 'component_id', id, 'contact_id', ids); }
  static setIPs(id, ids, client) { return replaceLinks(client, 'system_component_ip', 'component_id', id, 'ip_id', ids); }
  static setTags(id, ids, client) { return replaceTags(client, 'component', id, ids); }

  static async getIpIds(id) {
    const result = await pool.query('SELECT ip_id FROM system_component_ip WHERE component_id = $1', [id]);
    return result.rows.map((row) => row.ip_id);
  }

  // ===== Lists =====
  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const limit = w.param(pageSize);
    const offset = w.param((page - 1) * pageSize);
    const result = await pool.query(
      `${SELECT_WITH_RELATIONS} WHERE ${w} GROUP BY sc.id, s.name ORDER BY ${searchRank(['sc.name'], filter.search, w)}sc.id DESC LIMIT ${limit} OFFSET ${offset}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM system_components sc WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2 lookup: [{id, text}]
  static async select2Search({ search = '', limit = 20, systemId = null }) {
    // systemId: only that system's components, text = the component's name
    if (systemId) {
      const { rows } = await pool.query(
        `SELECT id, name FROM system_components WHERE system_id = $1 AND name ILIKE $2 ORDER BY ${matchOrder(['name'], '$4')} LIMIT $3`,
        [systemId, `%${search}%`, limit, search]);
      return rows.map((row) => ({ id: row.id, text: row.name }));
    }
    // text "System / Component"; found by the component's or the system's name
    const result = await pool.query(
      `SELECT sc.id, sc.name, s.name AS system_name FROM system_components sc JOIN systems s ON s.id = sc.system_id
       WHERE sc.name ILIKE $1 OR s.name ILIKE $1 ORDER BY ${matchOrder(['sc.name', 's.name'], '$3')} LIMIT $2`,
      [`%${search}%`, limit, search]
    );
    return result.rows.map((row) => ({ id: row.id, text: `${row.system_name} / ${row.name}` }));
  }
}

export default SystemComponent;
