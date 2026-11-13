// Customers (and partners / vendors) with their contacts, connections and the
// IPs / networks of the customer behind each connection.
import { pool } from '../../../config/config.js';
import { db, Where, subList, searchRank } from '../../shared/db.js';

// "10.1.2.3/32" -> "10.1.2.3"; other networks keep their prefix
export const NETWORK_TEXT = (col) => `CASE WHEN masklen(${col}) = 32 THEN host(${col}) ELSE ${col}::text END`;

const NETWORKS = (connAlias) => subList(
  { id: 'n.id', network: NETWORK_TEXT('n.network'), description: 'n.description' },
  `FROM customer_networks n WHERE n.connection_id = ${connAlias}.id`, '(n.position, n.id)');

const SELECT_WITH_LINKS = `
  SELECT c.*,
    CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id', u.id, 'name', u.name) END AS unit,
    ${subList({ id: 'oc.id', name: 'oc.name', email: 'oc.email' },
      'FROM customer_owner_contacts x JOIN contacts oc ON oc.id = x.contact_id WHERE x.customer_id = c.id', 'oc.id')} AS owners,
    ${subList({ id: 'p.id', name: 'p.name', role: 'p.role', email: 'p.email', phone: 'p.phone' },
      'FROM customer_contacts p WHERE p.customer_id = c.id', '(p.position, p.id)')} AS contacts,
    ${subList({
      id: 'cc.id', name: 'cc.name', channel: 'cc.channel', role: 'cc.role', device_id: 'cc.device_id', device_name: 'd.name', local_ip_id: 'cc.local_ip_id', local_ip: 'li.ip_address',
      status: 'cc.status', start_date: "to_char(cc.start_date, 'YYYY-MM-DD')", end_date: "to_char(cc.end_date, 'YYYY-MM-DD')",
      description: 'cc.description', networks: NETWORKS('cc'),
    }, `FROM customer_connections cc
        LEFT JOIN devices d ON d.id = cc.device_id
        LEFT JOIN ip_addresses li ON li.id = cc.local_ip_id
        WHERE cc.customer_id = c.id`, '(cc.position, cc.id)')} AS connections
  FROM customers c
  LEFT JOIN units u ON u.id = c.unit_id`;

// filter: {search, type[], status[], channel[], unit_id, device_id, attr: {key: value} (select fields)}
function filterWhere({ search = '', type = [], status = [], channel = [], unit_id, device_id, attr = {} }) {
  const w = new Where();
  w.search(search, ['c.name ILIKE ?', 'c.code ILIKE ?', 'c.description ILIKE ?', 'c.attributes::text ILIKE ?',
    'EXISTS (SELECT 1 FROM customer_contacts x WHERE x.customer_id = c.id AND (x.name ILIKE ? OR x.email ILIKE ?))',
    `EXISTS (SELECT 1 FROM customer_connections x LEFT JOIN ip_addresses i ON i.id = x.local_ip_id
       WHERE x.customer_id = c.id AND (x.name ILIKE ? OR i.ip_address::text ILIKE ?))`,
    'EXISTS (SELECT 1 FROM customer_networks x WHERE x.customer_id = c.id AND (x.network::text ILIKE ? OR x.description ILIKE ?))']);
  if (type.length) w.add(`c.type = ANY(${w.param(type)})`);
  if (status.length) w.add(`c.status = ANY(${w.param(status)})`);
  if (channel.length) w.add(`EXISTS (SELECT 1 FROM customer_connections x WHERE x.customer_id = c.id AND x.channel = ANY(${w.param(channel)}))`);
  if (Number(unit_id)) w.add(`c.unit_id = ${w.param(Number(unit_id))}`);
  if (Number(device_id)) w.add(`EXISTS (SELECT 1 FROM customer_connections x WHERE x.customer_id = c.id AND x.device_id = ${w.param(Number(device_id))})`);
  for (const [key, value] of Object.entries(attr || {})) {
    if (value) w.add(`c.attributes ->> ${w.param(key)} = ${w.param(String(value))}`);
  }
  return w;
}

class Customer {
  static async create({ code, name, type, status, unit_id, description, attributes, updated_by }, client) {
    const result = await db(client).query(
      `INSERT INTO customers (code, name, type, status, unit_id, description, attributes, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [code, name, type, status, unit_id, description, JSON.stringify(attributes || {}), updated_by]);
    return result.rows[0];
  }

  static async update(id, { code, name, type, status, unit_id, description, attributes, updated_by }, client) {
    await db(client).query(
      `UPDATE customers SET code = $1, name = $2, type = $3, status = $4, unit_id = $5, description = $6, attributes = $7,
         updated_by = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9`,
      [code, name, type, status, unit_id, description, JSON.stringify(attributes || {}), updated_by, id]);
  }

  // Contacts, connections and networks cascade
  static async delete(id, client) {
    await db(client).query('DELETE FROM customers WHERE id = $1', [id]);
  }

  static async findById(id, client) {
    const result = await db(client).query('SELECT * FROM customers WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    return (await pool.query('SELECT 1 FROM customers WHERE id = $1', [id])).rowCount > 0;
  }

  static async findWithLinks(id, client) {
    const result = await db(client).query(`${SELECT_WITH_LINKS} WHERE c.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async findByNameExact(name, client) {
    const result = await db(client).query('SELECT * FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [name]);
    return result.rows;
  }

  static async findByCode(code, client) {
    const result = await db(client).query('SELECT * FROM customers WHERE LOWER(code) = LOWER($1)', [code]);
    return result.rows;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ORDER BY ${searchRank(['c.name', 'c.code'], filter.search, w)}c.name, c.id
       LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`, w.params);
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*)::int AS n FROM customers c WHERE ${w}`, w.params);
    return result.rows[0].n;
  }

  // Select2: ?search= -> [{id, text}]
  static async select2Search(search = '', limit = 20) {
    const result = await pool.query(
      `SELECT id, CASE WHEN code IS NULL THEN name ELSE name || ' (' || code || ')' END AS text FROM customers
       WHERE name ILIKE $1 OR code ILIKE $1 ORDER BY name LIMIT $2`, [`%${search}%`, limit]);
    return result.rows;
  }

  static async findByIds(ids) {
    if (!ids.length) return [];
    return (await pool.query('SELECT id, name, code FROM customers WHERE id = ANY($1::int[])', [ids])).rows;
  }

  // ===== Links =====
  static async setOwners(id, contactIds, client) {
    const ex = db(client);
    await ex.query('DELETE FROM customer_owner_contacts WHERE customer_id = $1', [id]);
    for (const contactId of contactIds) {
      await ex.query('INSERT INTO customer_owner_contacts (customer_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, contactId]);
    }
  }

  // contacts: [{name, role, email, phone}] in their order
  static async setContacts(id, contacts, client) {
    const ex = db(client);
    await ex.query('DELETE FROM customer_contacts WHERE customer_id = $1', [id]);
    for (const [i, p] of contacts.entries()) {
      await ex.query('INSERT INTO customer_contacts (customer_id, name, role, email, phone, position) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, p.name, p.role, p.email, p.phone, i]);
    }
  }

  // connections: [{id?, name, channel, ..., networks: [{network, description}]}] in their order.
  // Ids are kept: an existing connection (id of this customer) is updated, the others
  // are removed, the new ones inserted; a network keeps its id while it stays on its
  // connection (others can refer to it).
  static async setConnections(id, connections, updatedBy, client) {
    const ex = db(client);
    const keep = connections.map((x) => x.id).filter(Boolean);
    await ex.query('DELETE FROM customer_connections WHERE customer_id = $1 AND NOT (id = ANY($2::int[]))', [id, keep]);
    for (const [i, x] of connections.entries()) {
      const values = [x.name, x.channel, x.role, x.device_id, x.local_ip_id, x.status, x.start_date, x.end_date, x.description, i, updatedBy];
      let connId = x.id;
      if (connId) {
        await ex.query(
          `UPDATE customer_connections SET name = $1, channel = $2, role = $3, device_id = $4, local_ip_id = $5, status = $6,
             start_date = $7, end_date = $8, description = $9, position = $10, updated_by = $11, updated_at = CURRENT_TIMESTAMP
           WHERE id = $12 AND customer_id = $13`, [...values, connId, id]);
      } else {
        connId = (await ex.query(
          `INSERT INTO customer_connections (name, channel, role, device_id, local_ip_id, status, start_date, end_date, description,
             position, updated_by, customer_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`, [...values, id])).rows[0].id;
      }
      await ex.query('DELETE FROM customer_networks WHERE connection_id = $1 AND NOT (network = ANY($2::cidr[]))', [connId, x.networks.map((n) => n.network)]);
      for (const [j, n] of x.networks.entries()) {
        await ex.query(
          `INSERT INTO customer_networks (customer_id, connection_id, network, description, position) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (connection_id, network) DO UPDATE SET description = EXCLUDED.description, position = EXCLUDED.position`,
          [id, connId, n.network, n.description, j]);
      }
    }
  }

  // The customer's connections [{id, channel}] (an id posted for another customer is a new connection)
  static async connectionChannels(id, client) {
    return (await db(client).query('SELECT id, channel FROM customer_connections WHERE customer_id = $1', [id])).rows;
  }
}

export default Customer;
