import { pool } from '../../../config/config.js';
import { db, Where, replaceTags, jsonList } from '../../shared/db.js';

const IP_OR_CIDR = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;

// Subnet with gateway IP, tags and the number of IP records inside it
const SELECT_WITH_LINKS = `
  SELECT s.*, gw.ip_address AS gateway_ip_address,
    ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags,
    (SELECT COUNT(*)::int FROM ip_addresses x WHERE x.ip_address::inet <<= s.address) AS ip_count
  FROM subnets s
  LEFT JOIN ip_addresses gw ON gw.id = s.gateway_ip_id
  LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
  LEFT JOIN tags t ON t.id = tobj.tag_id`;
const GROUP_BY = 'GROUP BY s.id, gw.ip_address';

// filter: {search, tags[], zone, environment}; zone / environment accept NONE.
// A search that looks like an IP or CIDR finds the subnets containing it.
function filterWhere({ search = '', tags = [], zone, environment }) {
  const w = new Where();
  if (search && IP_OR_CIDR.test(search)) w.add(`s.address >>= ${w.param(search)}::inet`);
  else w.search(search, ['s.address::text ILIKE ?', 's.description ILIKE ?', 's.zone ILIKE ?', 's.environment ILIKE ?']);
  if (tags.length) w.add(`EXISTS (SELECT 1 FROM tag_object x WHERE x.object_type = 'subnet' AND x.object_id = s.id AND x.tag_id = ANY(${w.param(tags.map(Number))}))`);
  for (const [col, value] of [['zone', zone], ['environment', environment]]) {
    if (value) w.anyOf([value], (v) => `s.${col} = ${w.param(v[0])}`, `COALESCE(s.${col}, '') = ''`);
  }
  return w;
}

const COLUMNS = ['address', 'description', 'zone', 'environment', 'gateway_ip_id', 'updated_by'];

class Subnet {
  static async create(data, client) {
    const result = await db(client).query(
      `INSERT INTO subnets (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      COLUMNS.map((c) => data[c] ?? null)
    );
    return result.rows[0];
  }

  // address is immutable
  static async update(id, { description, zone, environment, gateway_ip_id, updated_by }, client) {
    await db(client).query(
      'UPDATE subnets SET description = $1, zone = $2, environment = $3, gateway_ip_id = $4, updated_by = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [description ?? null, zone ?? null, environment ?? null, gateway_ip_id ?? null, updated_by ?? null, id]
    );
  }

  static async remove(id, client) {
    await replaceTags(client, 'subnet', id, []);
    await db(client).query('DELETE FROM subnets WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE s.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  static async findByAddressWithDetails(address) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE s.address = $1::inet ${GROUP_BY}`, [address]);
    return result.rows[0] || null;
  }

  static async findByAddress(address) {
    const result = await pool.query('SELECT * FROM subnets WHERE address = $1::inet', [address]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM subnets WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Whether an IP record lies inside the subnet (the gateway must)
  static async isIpInSubnet(subnetAddress, ipId) {
    const result = await pool.query('SELECT $1::inet >>= ip_address::inet AS contains FROM ip_addresses WHERE id = $2', [subnetAddress, ipId]);
    return result.rows[0]?.contains === true;
  }

  // Most specific subnet containing an IP or a smaller subnet
  static async findContainingSubnet(ipOrSubnet) {
    const result = await pool.query('SELECT * FROM subnets WHERE address >>= $1::inet ORDER BY masklen(address) DESC LIMIT 1', [ipOrSubnet]);
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10, search = '' } = filter;
    const w = filterWhere(filter);
    // an IP / CIDR search lists the most specific subnet first
    const order = search && IP_OR_CIDR.test(search) ? 'masklen(s.address) DESC' : 's.updated_at DESC, s.id DESC';
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY ${order} LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM subnets s WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Distinct non-empty zone / environment values
  static async distinctValues(column) {
    if (!['zone', 'environment'].includes(column)) throw new Error(`Unsupported column: ${column}`);
    const result = await pool.query(`SELECT DISTINCT ${column} AS value FROM subnets WHERE COALESCE(${column}, '') <> '' ORDER BY 1`);
    return result.rows.map((r) => r.value);
  }

  static setTags(id, ids, client) { return replaceTags(client, 'subnet', id, ids); }
}

export default Subnet;
