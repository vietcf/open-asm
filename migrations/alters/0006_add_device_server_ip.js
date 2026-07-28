// A VIP (virtual IP for HA/cluster setups) can be active on more than one
// device or server at a time. ip_addresses.device_id / server_id are scalar
// FKs, so each IP row can only record a single owner of each kind. This adds
// proper many-to-many link tables (same shape as cluster_members) so an IP
// can carry a 'normal' owner plus any number of 'vip' co-owners.
//
// ip_addresses.ip_type is derived, not user-editable: IpAddress.recomputeIpType
// keeps it in sync with the real link count on every add/remove of a VIP link.
//
// The old device_id/server_id columns are intentionally left in place here —
// dropping them is a separate follow-up migration once all read/write paths
// have cut over to device_ip/server_ip and production has been observed.
export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_ip (
      id SERIAL PRIMARY KEY,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      role VARCHAR(100) DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      UNIQUE (device_id, ip_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_ip (
      id SERIAL PRIMARY KEY,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      role VARCHAR(100) DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      UNIQUE (server_id, ip_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_device_ip_device ON device_ip(device_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_device_ip_ip ON device_ip(ip_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_server_ip_server ON server_ip(server_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_server_ip_ip ON server_ip(ip_id);`);

  await pool.query(`ALTER TABLE ip_addresses ADD COLUMN IF NOT EXISTS ip_type VARCHAR(20) DEFAULT 'physical';`);

  // Backfill existing single-owner links as 'normal'.
  await pool.query(`
    INSERT INTO device_ip (device_id, ip_id, role, updated_by)
      SELECT device_id, id, 'normal', updated_by FROM ip_addresses WHERE device_id IS NOT NULL
      ON CONFLICT (device_id, ip_id) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO server_ip (server_id, ip_id, role, updated_by)
      SELECT server_id, id, 'normal', updated_by FROM ip_addresses WHERE server_id IS NOT NULL
      ON CONFLICT (server_id, ip_id) DO NOTHING;
  `);
};
