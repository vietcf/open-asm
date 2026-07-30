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
      updated_by VARCHAR(255) DEFAULT NULL,
      gateway_ip_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL
    );
  `);
  // gateway_ip_id: the IP address (usually a VIP) acting as this subnet's
  // gateway. ip_addresses is created before subnets in init_all_tables.js,
  // so the FK target already exists here.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_subnets_gateway_ip_id ON subnets (gateway_ip_id);
  `);

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
