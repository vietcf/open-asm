// Migration for subnets table
export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subnets (
      id SERIAL PRIMARY KEY,
      address inet NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255) DEFAULT NULL
    );
  `);
  
  // Create index for updated_at to optimize sorting
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_subnets_updated_at ON subnets (updated_at DESC);
  `);
  console.log('Created subnets table');
};
