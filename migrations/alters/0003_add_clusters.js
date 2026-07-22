// Cluster tracking (e.g. an OpenShift cluster or an Oracle RAC): a named
// group of IP-address members, each with a free-text role within that
// cluster. Membership is anchored on ip_address_id rather than server_id/
// device_id directly, since ip_addresses already resolves to whichever
// parent (server or device) it belongs to.
//
// cluster_system is a pure many-to-many link to systems (a cluster can serve
// several systems; a system can be backed by several clusters). Both FKs are
// ON DELETE CASCADE so deleting either side only cleans up the link row —
// it never touches or requires any code change in System/Server/Device.
export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clusters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cluster_members (
      id SERIAL PRIMARY KEY,
      cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
      ip_address_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      role VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      UNIQUE (cluster_id, ip_address_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cluster_system (
      cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
      system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      PRIMARY KEY (cluster_id, system_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cluster_members_ip ON cluster_members(ip_address_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cluster_system_system ON cluster_system(system_id);`);
};
