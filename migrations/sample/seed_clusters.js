// migrations/sample/seed_clusters.js
// Seed sample Cluster data — deliberately covers both a server-backed IP
// member and a device-backed IP member, since ip_addresses.device_id was
// never populated by any other seed file (seed_ip_addresses.js only ever
// sets server_id).
//
// IDs are looked up by name rather than hardcoded, same reasoning as
// seed_servers.js/seed_devices.js: not guaranteed to start at 1 on a
// non-pristine database.
export default async (pool) => {
  const { rows: serverRows } = await pool.query(
    "SELECT id, name FROM servers WHERE name IN ('Server A', 'Server B', 'Server C', 'Server D', 'Server E')"
  );
  const srv = {};
  serverRows.forEach(r => { srv[r.name] = r.id; });

  const { rows: deviceRows } = await pool.query(
    "SELECT id, name FROM devices WHERE name IN ('Router Core', 'Switch Edge', 'Firewall Main')"
  );
  const dev = {};
  deviceRows.forEach(r => { dev[r.name] = r.id; });

  // A few extra IPs dedicated to cluster membership — some tied to a
  // server, some tied to a device — so the seeded clusters exercise both
  // ownership paths.
  await pool.query(`
    INSERT INTO ip_addresses (ip_address, description, server_id, updated_by) VALUES
      ('10.10.10.11', 'OpenShift master node 1', ${srv['Server A'] || 'NULL'}, 'admin'),
      ('10.10.10.12', 'OpenShift master node 2', ${srv['Server B'] || 'NULL'}, 'admin'),
      ('10.10.10.13', 'OpenShift worker node 1', ${srv['Server C'] || 'NULL'}, 'admin'),
      ('10.10.10.21', 'Oracle RAC DB01 - primary', ${srv['Server D'] || 'NULL'}, 'admin'),
      ('10.10.10.22', 'Oracle RAC DB01 - standby', ${srv['Server E'] || 'NULL'}, 'admin')
    ON CONFLICT (ip_address) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO ip_addresses (ip_address, description, device_id, updated_by) VALUES
      ('10.10.20.1', 'Network core cluster - router', ${dev['Router Core'] || 'NULL'}, 'admin'),
      ('10.10.20.2', 'Network core cluster - switch', ${dev['Switch Edge'] || 'NULL'}, 'admin'),
      ('10.10.20.3', 'Network core cluster - firewall', ${dev['Firewall Main'] || 'NULL'}, 'admin')
    ON CONFLICT (ip_address) DO NOTHING;
  `);

  const { rows: ipRows } = await pool.query(
    "SELECT id, ip_address FROM ip_addresses WHERE ip_address IN ('10.10.10.11','10.10.10.12','10.10.10.13','10.10.10.21','10.10.10.22','10.10.20.1','10.10.20.2','10.10.20.3')"
  );
  const ip = {};
  ipRows.forEach(r => { ip[r.ip_address] = r.id; });

  const { rows: systemRows } = await pool.query(
    "SELECT id, name FROM systems WHERE name IN ('Quản lý phần mềm', 'Quản lý tài khoản', 'Quản lý mạng')"
  );
  const sys = {};
  systemRows.forEach(r => { sys[r.name] = r.id; });

  async function ensureCluster(name, description) {
    const { rows: existing } = await pool.query('SELECT id FROM clusters WHERE name = $1', [name]);
    if (existing.length > 0) return existing[0].id;
    const { rows } = await pool.query(
      'INSERT INTO clusters (name, description, updated_by) VALUES ($1, $2, $3) RETURNING id',
      [name, description, 'admin']
    );
    return rows[0].id;
  }

  async function addMember(clusterId, ipAddress, role) {
    const ipId = ip[ipAddress];
    if (!ipId) return;
    await pool.query(
      `INSERT INTO cluster_members (cluster_id, ip_address_id, role, updated_by) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (cluster_id, ip_address_id) DO NOTHING`,
      [clusterId, ipId, role]
    );
  }

  async function linkSystem(clusterId, systemName) {
    const systemId = sys[systemName];
    if (!systemId) return;
    await pool.query(
      'INSERT INTO cluster_system (cluster_id, system_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [clusterId, systemId]
    );
  }

  // OpenShift-style cluster: server-backed IP members, multiple Systems
  // hosted on the same platform.
  const openshiftId = await ensureCluster('OpenShift Production', 'Production OpenShift cluster hosting several internal applications.');
  await addMember(openshiftId, '10.10.10.11', 'master');
  await addMember(openshiftId, '10.10.10.12', 'master');
  await addMember(openshiftId, '10.10.10.13', 'worker');
  await linkSystem(openshiftId, 'Quản lý phần mềm');
  await linkSystem(openshiftId, 'Quản lý tài khoản');

  // Oracle RAC-style cluster: server-backed IP members, one primary System.
  const racId = await ensureCluster('Oracle RAC DB01', 'Oracle RAC cluster backing the account management database.');
  await addMember(racId, '10.10.10.21', 'primary');
  await addMember(racId, '10.10.10.22', 'standby');
  await linkSystem(racId, 'Quản lý tài khoản');

  // Network-hardware cluster: device-backed IP members (not servers) —
  // covers the "cluster of devices" case.
  const networkId = await ensureCluster('Network Core Cluster', 'Core network device group (router, switch, firewall) for the main site.');
  await addMember(networkId, '10.10.20.1', 'core');
  await addMember(networkId, '10.10.20.2', 'edge');
  await addMember(networkId, '10.10.20.3', 'gateway');
  await linkSystem(networkId, 'Quản lý mạng');
};
