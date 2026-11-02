import { pool } from '../../../config/config.js';
import { db, Where, NONE, replaceLinks, replaceTags, subList, matchOrder } from '../../shared/db.js';

// department_id = development department (L3), ops_department_id = operations department (L2)
const COLUMNS = ['system_id', 'name', 'level', 'department_id', 'ops_department_id', 'alias', 'description', 'fqdn', 'scopes', 'architecture', 'updated_by'];
const toRow = (data) => COLUMNS.map((col) => {
  const value = data[col] ?? null;
  return (col === 'scopes' || col === 'architecture') && value ? JSON.stringify(value) : value;
});

// JSONB array filter (scopes, architecture): any selected value, or NONE = empty
function jsonbAnyOf(w, column, values) {
  w.anyOf(values,
    (real) => `(${real.map((v) => `${column} @> ${w.param(JSON.stringify([v]))}`).join(' OR ')})`,
    `(${column} IS NULL OR ${column} = '[]'::jsonb)`);
}

function filterWhere({ search = '', filterTags = [], filterContacts = [], filterScopes = [], filterArchitecture = [], filterLevel = '', filterDepartment = '' }) {
  const w = new Where();
  w.search(search, [
    's.name ILIKE ?', 's.system_id ILIKE ?', 's.description ILIKE ?',
    'EXISTS (SELECT 1 FROM unnest(s.alias) a WHERE a ILIKE ?)',
    "EXISTS (SELECT 1 FROM tag_object x JOIN tags t ON t.id = x.tag_id WHERE x.object_type = 'system' AND x.object_id = s.id AND t.name ILIKE ?)",
    'EXISTS (SELECT 1 FROM system_contact x JOIN contacts c ON c.id = x.contact_id WHERE x.system_id = s.id AND c.name ILIKE ?)',
    'EXISTS (SELECT 1 FROM system_ip x JOIN ip_addresses ip ON ip.id = x.ip_id WHERE x.system_id = s.id AND ip.ip_address::text ILIKE ?)',
    'EXISTS (SELECT 1 FROM system_domain x JOIN domains d ON d.id = x.domain_id WHERE x.system_id = s.id AND d.domain ILIKE ?)',
    'EXISTS (SELECT 1 FROM system_components x WHERE x.system_id = s.id AND x.name ILIKE ?)',
  ]);
  if (filterTags.length) {
    w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'system' AND x.object_id = s.id AND x.tag_id = ANY(${w.param(filterTags.map(Number))}))`);
  }
  w.anyOf(filterContacts,
    (ids) => `EXISTS (SELECT 1 FROM system_contact x WHERE x.system_id = s.id AND x.contact_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM system_contact x WHERE x.system_id = s.id)');
  jsonbAnyOf(w, 's.scopes', filterScopes);
  jsonbAnyOf(w, 's.architecture', filterArchitecture);
  if (filterLevel === NONE) w.add('s.level IS NULL');
  else if (filterLevel) w.add(`s.level = ${w.param(filterLevel)}`);
  if (filterDepartment === NONE) {
    w.add('s.department_id IS NULL AND s.ops_department_id IS NULL');
  } else if (filterDepartment) {
    const p = w.param(parseInt(filterDepartment, 10));
    w.add(`(s.department_id = ${p} OR s.ops_department_id = ${p})`);
  }
  return w;
}

class System {
  static async create(data, client) {
    const result = await db(client).query(
      `INSERT INTO systems (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      toRow(data)
    );
    return result.rows[0];
  }

  static async update(id, data, client) {
    const result = await db(client).query(
      `UPDATE systems SET ${COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${COLUMNS.length + 1} RETURNING *`,
      [...toRow(data), id]
    );
    return result.rows[0];
  }

  static async delete(id, client) {
    await db(client).query('DELETE FROM systems WHERE id = $1', [id]);
  }

  static async findById(id, client) {
    const result = await db(client).query(
      `SELECT s.*, u.name AS department_name, uo.name AS ops_department_name
       FROM systems s
       LEFT JOIN units u ON s.department_id = u.id
       LEFT JOIN units uo ON s.ops_department_id = uo.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM systems WHERE id = ANY($1)', [ids]);
    return result.rows;
  }

  static async findByNameExact(name) {
    const result = await pool.query('SELECT * FROM systems WHERE LOWER(name) = LOWER($1) ORDER BY id', [name]);
    return result.rows;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM systems WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async existsBySystemId(systemId, excludeId = null) {
    const result = await pool.query('SELECT 1 FROM systems WHERE system_id = $1 AND ($2::int IS NULL OR id <> $2)', [systemId, excludeId]);
    return result.rowCount > 0;
  }

  static async existsByName(name, excludeId = null) {
    const result = await pool.query('SELECT 1 FROM systems WHERE LOWER(name) = LOWER($1) AND ($2::int IS NULL OR id <> $2)', [name, excludeId]);
    return result.rowCount > 0;
  }

  // ===== Links =====
  static setContacts(id, ids, client) { return replaceLinks(client, 'system_contact', 'system_id', id, 'contact_id', ids); }
  static setIPs(id, ids, client) { return replaceLinks(client, 'system_ip', 'system_id', id, 'ip_id', ids); }
  static setDomains(id, ids, client) { return replaceLinks(client, 'system_domain', 'system_id', id, 'domain_id', ids); }
  static setTags(id, ids, client) { return replaceTags(client, 'system', id, ids); }

  static async addIPs(id, ipIds, client) {
    if (!ipIds || !ipIds.length) return;
    await db(client).query('INSERT INTO system_ip (system_id, ip_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [id, ipIds]);
  }

  static async removeIP(id, ipId, client) {
    await db(client).query('DELETE FROM system_ip WHERE system_id = $1 AND ip_id = $2', [id, ipId]);
  }

  static async getIpIds(id) {
    const result = await pool.query('SELECT ip_id FROM system_ip WHERE system_id = $1', [id]);
    return result.rows.map((row) => row.ip_id);
  }

  // Current links as Select2 options ({id, text}) for the edit form
  static async findLinkOptions(id) {
    const [contacts, ips, domains, tags] = await Promise.all([
      pool.query(`SELECT c.id, CASE WHEN c.email <> '' THEN c.name || ' (' || c.email || ')' ELSE c.name END AS text
                  FROM system_contact x JOIN contacts c ON c.id = x.contact_id WHERE x.system_id = $1 ORDER BY c.name`, [id]),
      pool.query(`SELECT ip.id, ip.ip_address AS text
                  FROM system_ip x JOIN ip_addresses ip ON ip.id = x.ip_id WHERE x.system_id = $1 ORDER BY ip.ip_address`, [id]),
      pool.query(`SELECT d.id, d.domain AS text
                  FROM system_domain x JOIN domains d ON d.id = x.domain_id WHERE x.system_id = $1 ORDER BY d.domain`, [id]),
      pool.query(`SELECT t.id, t.name AS text
                  FROM tag_object x JOIN tags t ON t.id = x.tag_id WHERE x.object_type = 'system' AND x.object_id = $1 ORDER BY t.name`, [id]),
    ]);
    return { contacts: contacts.rows, ip_addresses: ips.rows, domains: domains.rows, tags: tags.rows };
  }

  // ===== Lists =====
  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const limit = w.param(pageSize);
    const offset = w.param((page - 1) * pageSize);
    const result = await pool.query(`
      SELECT s.*,
        u.name AS department_name,
        uo.name AS ops_department_name,
        ${subList({ id: 't.id', name: 't.name' },
          "FROM tag_object tobj JOIN tags t ON t.id = tobj.tag_id WHERE tobj.object_type = 'system' AND tobj.object_id = s.id", 't.id')} AS tags,
        ${subList({ id: 'c.id', name: 'c.name', email: 'c.email' },
          'FROM system_contact sc JOIN contacts c ON c.id = sc.contact_id WHERE sc.system_id = s.id', 'c.id')} AS contacts,
        ${subList({ id: 'ip.id', ip: 'ip.ip_address', server_name: 'srv.name', subnet_zone: 'sub.zone', subnet_environment: 'sub.environment' },
          `FROM system_ip sip JOIN ip_addresses ip ON ip.id = sip.ip_id
           LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
           LEFT JOIN servers srv ON srv.id = svi.server_id
           LEFT JOIN LATERAL (
             SELECT zone, environment FROM subnets x
             WHERE x.address >>= ip.ip_address::inet
             ORDER BY masklen(x.address) DESC LIMIT 1
           ) sub ON true
           WHERE sip.system_id = s.id`, 'ip.id')} AS ip_addresses,
        ${subList({ id: 'd.id', domain: 'd.domain' },
          'FROM system_domain sd JOIN domains d ON d.id = sd.domain_id WHERE sd.system_id = s.id', 'd.id')} AS domains,
        ${subList({ id: 'f.id', name: 'f.original_name', url: 'f.file_path' },
          "FROM file_uploads f WHERE f.object_type = 'system' AND f.object_id = s.id", 'f.id')} AS docs
      FROM systems s
      LEFT JOIN units u ON s.department_id = u.id
      LEFT JOIN units uo ON s.ops_department_id = uo.id
      WHERE ${w}
      ORDER BY s.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, w.params);
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) AS count FROM systems s WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2 lookup: [{id, text}]
  static async select2Search({ search = '', limit = 20 }) {
    const result = await pool.query(
      `SELECT id, name, system_id FROM systems
       WHERE name ILIKE $1 OR system_id ILIKE $1
       ORDER BY ${matchOrder(['name', 'system_id'], '$3')} LIMIT $2`,
      [`%${search}%`, limit, search]
    );
    return result.rows.map((row) => ({ id: row.id, text: row.name ? `${row.name} (${row.system_id})` : row.system_id }));
  }
}

export default System;
