import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, replaceTags, jsonList } from '../../shared/db.js';

// Domain with its IP ({id, ip_address} or null), systems and tags
const SELECT_WITH_LINKS = `
  SELECT d.*,
    CASE WHEN ip.id IS NULL THEN NULL ELSE jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) END AS ip,
    ${jsonList('s', { id: 's.id', name: 's.name', system_id: 's.system_id' })} AS systems,
    ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags
  FROM domains d
  LEFT JOIN ip_addresses ip ON ip.id = d.ip_id
  LEFT JOIN system_domain sd ON sd.domain_id = d.id
  LEFT JOIN systems s ON s.id = sd.system_id
  LEFT JOIN tag_object tobj ON tobj.object_type = 'domain' AND tobj.object_id = d.id
  LEFT JOIN tags t ON t.id = tobj.tag_id`;
const GROUP_BY = 'GROUP BY d.id, ip.id';

// filter: {search, record_type[], tags[], systems[]}; systems accepts NONE
function filterWhere({ search = '', record_type = [], tags = [], systems = [] }) {
  const w = new Where();
  w.search(search, ['d.domain ILIKE ?', 'd.description ILIKE ?',
    'EXISTS (SELECT 1 FROM ip_addresses x WHERE x.id = d.ip_id AND x.ip_address ILIKE ?)',
    'EXISTS (SELECT 1 FROM system_domain x JOIN systems sy ON sy.id = x.system_id WHERE x.domain_id = d.id AND sy.name ILIKE ?)']);
  const types = [].concat(record_type).filter(Boolean);
  if (types.length) w.add(`d.record_type = ANY(${w.param(types)})`);
  if (tags.length) w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'domain' AND x.object_id = d.id AND x.tag_id = ANY(${w.param(tags.map(Number))}))`);
  w.anyOf(systems, (ids) => `EXISTS (SELECT 1 FROM system_domain x WHERE x.domain_id = d.id AND x.system_id = ANY(${w.param(ids.map(Number))}))`,
    'NOT EXISTS (SELECT 1 FROM system_domain x WHERE x.domain_id = d.id)');
  return w;
}

class Domain {
  static async create({ domain, description, ip_id, record_type }, client) {
    const result = await db(client).query(
      'INSERT INTO domains (domain, description, ip_id, record_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [domain, description ?? null, ip_id ?? null, record_type ?? null]
    );
    return result.rows[0];
  }

  // The name is immutable
  static async update(id, { description, ip_id, record_type }, client) {
    await db(client).query('UPDATE domains SET description = $1, ip_id = $2, record_type = $3 WHERE id = $4',
      [description ?? null, ip_id ?? null, record_type ?? null, id]);
  }

  // system_domain cascades; tags are polymorphic
  static async remove(id, client) {
    await replaceTags(client, 'domain', id, []);
    await db(client).query('DELETE FROM domains WHERE id = $1', [id]);
  }

  static async findById(id, client) {
    const result = await db(client).query(`${SELECT_WITH_LINKS} WHERE d.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  // Exact (case-sensitive, like the UNIQUE constraint)
  static async findByDomain(name) {
    const result = await pool.query('SELECT * FROM domains WHERE domain = $1', [name]);
    return result.rows[0] || null;
  }

  static async findByNameWithLinks(name) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE d.domain = $1 ${GROUP_BY}`, [name]);
    return result.rows;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM domains WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY d.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM domains d WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2 lookup: [{id, text}]
  static async select2Search(search = '', limit = 20) {
    const result = await pool.query('SELECT id, domain AS text FROM domains WHERE domain ILIKE $1 ORDER BY domain LIMIT $2', [`%${search}%`, limit]);
    return result.rows;
  }

  static async findByIds(ids) {
    const result = await pool.query('SELECT id, domain FROM domains WHERE id = ANY($1::int[]) ORDER BY domain', [ids]);
    return result.rows;
  }

  static setSystems(id, ids, client) { return replaceLinks(client, 'system_domain', 'domain_id', id, 'system_id', ids); }
  static setTags(id, ids, client) { return replaceTags(client, 'domain', id, ids); }
}

export default Domain;
