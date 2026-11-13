// 0038_partner_ips_customers
// The partner IPs of the service mappings become a customer and one of its
// registered IPs / networks (customers, 0037), instead of a free-text partner name
// and an address.
//   virtual_server_partner_ips.customer_id   the customer (RESTRICT: a customer used by a
//                                            service mapping cannot be deleted)
//   virtual_server_partner_ips.network_id    its registered IP / network (RESTRICT likewise);
//                                            address stays, the network as text
//   virtual_server_partner_ips.partner       dropped (now the customer's name)
//   configuration service_mapping_partner    dropped (its names became customers)
//
// Data (no row is lost):
//   - every partner name in use, and every name of the service_mapping_partner list,
//     becomes a customer (an existing customer of the same name, case-insensitive, is
//     reused; new ones: type Partner when that type exists, status active); rows without
//     a name go to the customer "Chưa phân loại" (unclassified), to sort out later
//   - each row's address becomes a network of that customer, on a connection of the
//     customer for the channel of its flow (public flows: Internet whitelist; private
//     flows: the mapping's provider when it is a channel, else VPN site-to-site; the
//     connection of that channel is reused or created); an address with host bits set
//     (10.0.0.1/24) is stored as its network (10.0.0.0/24)
//   - an address that is not an IPv4 / CIDR keeps its row with the customer only
const UNCLASSIFIED = 'Chưa phân loại';
const IPV4_CIDR = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/;

const validNetwork = (address) => {
  const m = IPV4_CIDR.exec(String(address || '').trim());
  return Boolean(m) && m.slice(1, 5).every((o) => Number(o) <= 255) && (m[5] === undefined || Number(m[5]) <= 32);
};

export async function up(db) {
  await db.query(`
    ALTER TABLE virtual_server_partner_ips
      ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
      ADD COLUMN network_id INTEGER REFERENCES customer_networks(id) ON DELETE RESTRICT;
    CREATE INDEX idx_vs_partner_ips_customer ON virtual_server_partner_ips (customer_id);
    CREATE INDEX idx_vs_partner_ips_network ON virtual_server_partner_ips (network_id);
  `);

  const listOf = async (key) => {
    const { rows } = await db.query('SELECT value FROM configuration WHERE key = $1', [key]);
    try { return (JSON.parse(rows[0]?.value || '[]') || []).map((o) => (o && typeof o === 'object' ? o : { value: String(o) })); } catch { return []; }
  };
  const types = await listOf('customer_type');
  const channels = await listOf('customer_channel');
  const partnerType = types.find((o) => String(o.value).toLowerCase() === 'partner')?.value ?? null;
  const channelNamed = (name) => channels.find((o) => String(o.value).toLowerCase() === String(name || '').toLowerCase())?.value;
  const defaultChannel = (wanted) => channelNamed(wanted) ?? channels.find((o) => o.active !== false)?.value ?? wanted;

  const customers = new Map(); // lower(name) -> id
  const customerId = async (name) => {
    const key = name.trim().toLowerCase();
    if (customers.has(key)) return customers.get(key);
    let { rows } = await db.query('SELECT id FROM customers WHERE LOWER(TRIM(name)) = $1', [key]);
    if (!rows.length) {
      ({ rows } = await db.query(
        `INSERT INTO customers (name, type, status, description, updated_by) VALUES ($1, $2, 'active', $3, 'migration') RETURNING id`,
        [name.trim(), partnerType, name === UNCLASSIFIED ? 'Partner IPs of service mappings without a partner name (migration 0038): move them to their customer' : 'Partner of the service mappings (migration 0038)']));
    }
    customers.set(key, rows[0].id);
    return rows[0].id;
  };

  const connections = new Map(); // customer|channel -> id
  const connectionId = async (custId, channel) => {
    const key = `${custId}|${channel}`;
    if (connections.has(key)) return connections.get(key);
    let { rows } = await db.query('SELECT id FROM customer_connections WHERE customer_id = $1 AND channel = $2 ORDER BY position, id LIMIT 1', [custId, channel]);
    if (!rows.length) {
      const taken = await db.query('SELECT 1 FROM customer_connections WHERE customer_id = $1 AND LOWER(TRIM(name)) = LOWER($2)', [custId, channel]);
      ({ rows } = await db.query(
        `INSERT INTO customer_connections (customer_id, name, channel, status, description, updated_by)
         VALUES ($1, $2, $3, 'active', 'Created from the service mapping partner IPs (migration 0038)', 'migration') RETURNING id`,
        [custId, taken.rowCount ? `${channel} (service mappings)` : channel, channel]));
    }
    connections.set(key, rows[0].id);
    return rows[0].id;
  };

  // the configured partner names become customers too
  for (const o of await listOf('service_mapping_partner')) if (String(o.value || '').trim()) await customerId(String(o.value));

  const { rows } = await db.query(`
    SELECT p.id, p.address, p.partner, vs.direction, vs.scope, vs.provider
    FROM virtual_server_partner_ips p JOIN virtual_servers vs ON vs.id = p.virtual_server_id ORDER BY p.id`);
  for (const r of rows) {
    const custId = await customerId(String(r.partner || '').trim() || UNCLASSIFIED);
    if (!validNetwork(r.address)) {
      await db.query('UPDATE virtual_server_partner_ips SET customer_id = $1 WHERE id = $2', [custId, r.id]);
      continue;
    }
    const channel = r.scope === 'public' ? defaultChannel('Internet whitelist') : (channelNamed(r.provider) ?? defaultChannel('VPN site-to-site'));
    const connId = await connectionId(custId, channel);
    const { rows: [net] } = await db.query(
      `WITH n AS (SELECT network($1::inet) AS network)
       INSERT INTO customer_networks (customer_id, connection_id, network, description)
       SELECT $2, $3, n.network, 'From the service mappings (migration 0038)' FROM n
       ON CONFLICT (connection_id, network) DO UPDATE SET network = EXCLUDED.network
       RETURNING id, CASE WHEN masklen(network) = 32 THEN host(network) ELSE network::text END AS text`,
      [r.address.trim(), custId, connId]);
    await db.query('UPDATE virtual_server_partner_ips SET customer_id = $1, network_id = $2, address = $3 WHERE id = $4', [custId, net.id, net.text, r.id]);
  }

  await db.query(`
    DROP INDEX IF EXISTS idx_vs_partner_ips_partner;
    ALTER TABLE virtual_server_partner_ips DROP COLUMN partner;
    DELETE FROM configuration WHERE key = 'service_mapping_partner';
  `);
}
