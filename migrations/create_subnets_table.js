// Migration for subnets table
export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subnets (
      id SERIAL PRIMARY KEY,
      address inet NOT NULL UNIQUE,
      description TEXT,
      zone VARCHAR(255) DEFAULT NULL,
      environment VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255) DEFAULT NULL
    );
  `);
  // gateway_device_id/gateway_cluster_id are added later by
  // migrations/alters/0005_add_subnet_gateway.js, not here — at this point
  // in init_all_tables.js, devices doesn't exist yet (created after subnets)
  // and clusters doesn't exist at all (only created by alters/0003, which
  // runs after this whole script). The alters step always runs after
  // init_all_tables.js, so both FK targets are guaranteed to exist by then.
  
  // Create index for updated_at to optimize sorting
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_subnets_updated_at ON subnets (updated_at DESC);
  `);
  
  // Create indexes for zone and environment to optimize filtering
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_subnets_zone ON subnets (zone);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_subnets_environment ON subnets (environment);
  `);
  
  console.log('Created subnets table');
};
