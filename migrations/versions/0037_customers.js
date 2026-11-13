// 0037_customers
// Customer management: customers (and partners / vendors), their contacts,
// connections (one per channel: Internet whitelist, VPN, MPLS...) and the IPs /
// networks (CIDR) of the customer behind each connection.
//   customers                 code, name, type / status (System Configuration lists),
//                             unit in charge, attributes JSONB: values of the custom
//                             fields declared in customer_custom_fields
//   customer_owner_contacts   our contacts in charge of the customer
//   customer_contacts         the customer's own people (not internal contacts)
//   customer_connections      channel, our device and IP, dates (the customer's own IPs,
//                             its VPN peer included, are customer_networks)
//   customer_networks         IP (/32) or CIDR of the customer, per connection
//   permissions               customer.create / read / update / delete: superadmin and
//                             admin get all, viewer gets read. Roles that do not exist
//                             are skipped.
//   configuration             customer_type, customer_status, customer_channel option
//                             lists, customer_custom_fields (empty).
// New tables only: no existing row changes.

const ACTIONS = ['create', 'read', 'update', 'delete'];

const LISTS = [
  ['customer_type', [['Customer', 'Customer'], ['Partner', 'Partner'], ['Vendor', 'Vendor']], 'Customer types'],
  ['customer_status', [['active', 'Active'], ['suspended', 'Suspended'], ['terminated', 'Terminated']], 'Customer statuses'],
  ['customer_channel', [['Internet whitelist', 'Internet whitelist'], ['VPN site-to-site', 'VPN site-to-site'], ['MPLS', 'MPLS'],
    ['Lease line', 'Lease line'], ['Client VPN', 'Client VPN']], 'Customer connection channels'],
];

export async function up(db) {
  await db.query(`
    CREATE TABLE customers (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100),
      status VARCHAR(100),
      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      description TEXT,
      attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX uniq_customers_name ON customers (LOWER(TRIM(name)));
    CREATE UNIQUE INDEX uniq_customers_code ON customers (LOWER(code)) WHERE code IS NOT NULL;
    CREATE INDEX idx_customers_unit ON customers (unit_id);
    CREATE INDEX idx_customers_attributes ON customers USING GIN (attributes);

    CREATE TABLE customer_owner_contacts (
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (customer_id, contact_id)
    );
    CREATE INDEX idx_customer_owner_contacts_contact ON customer_owner_contacts (contact_id);

    CREATE TABLE customer_contacts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_customer_contacts_customer ON customer_contacts (customer_id);

    CREATE TABLE customer_connections (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      channel VARCHAR(100) NOT NULL,
      role VARCHAR(20) CHECK (role IN ('primary', 'backup')),
      device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
      local_ip_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      start_date DATE,
      end_date DATE,
      description TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      updated_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
    );
    CREATE UNIQUE INDEX uniq_customer_connection_name ON customer_connections (customer_id, LOWER(TRIM(name)));
    CREATE INDEX idx_customer_connections_device ON customer_connections (device_id);
    CREATE INDEX idx_customer_connections_local_ip ON customer_connections (local_ip_id);

    CREATE TABLE customer_networks (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      connection_id INTEGER NOT NULL REFERENCES customer_connections(id) ON DELETE CASCADE,
      network CIDR NOT NULL CHECK (family(network) = 4),
      description VARCHAR(255),
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE (connection_id, network)
    );
    CREATE INDEX idx_customer_networks_customer ON customer_networks (customer_id);
    CREATE INDEX idx_customer_networks_network ON customer_networks USING GIST (network inet_ops);
  `);

  const names = ACTIONS.map((a) => `customer.${a}`);
  const { rows: perms } = await db.query(
    `INSERT INTO permissions (name, description) SELECT n, initcap(split_part(n, '.', 2)) || ' customer' FROM unnest($1::text[]) n
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`, [names]);
  const { rows: roles } = await db.query(`SELECT id, name FROM roles WHERE name IN ('superadmin', 'admin', 'viewer')`);
  for (const role of roles) {
    for (const perm of perms) {
      if (role.name === 'viewer' && perm.name !== 'customer.read') continue;
      await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [role.id, perm.id]);
    }
  }

  for (const [key, items, description] of LISTS) {
    await db.query('INSERT INTO configuration (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
      [key, JSON.stringify(items.map(([value, label]) => ({ value, label }))), description]);
  }
  await db.query(`INSERT INTO configuration (key, value, description) VALUES ('customer_custom_fields', '[]', 'Custom fields of the customers')
    ON CONFLICT (key) DO NOTHING`);
}
