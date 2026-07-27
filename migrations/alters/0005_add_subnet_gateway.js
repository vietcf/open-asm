// Lets a subnet record which device (single box) or cluster (HA pair/group,
// via the existing clusters feature) serves as its gateway. Both optional
// and mutually exclusive — a subnet may simply not track this yet, and when
// it does, the gateway is either one physical device or one cluster, never
// both at once.
export default async (pool) => {
  await pool.query(`
    ALTER TABLE subnets
    ADD COLUMN IF NOT EXISTS gateway_device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS gateway_cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE subnets
    ADD CONSTRAINT subnets_gateway_exclusive_check
    CHECK (gateway_device_id IS NULL OR gateway_cluster_id IS NULL);
  `).catch((err) => {
    // Constraint already exists from a previous run of this migration.
    if (err.code !== '42710') throw err;
  });
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subnets_gateway_device_id ON subnets (gateway_device_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subnets_gateway_cluster_id ON subnets (gateway_cluster_id);`);
};
