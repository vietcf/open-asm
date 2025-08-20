// Migration for subnets table
export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subnets (
      id SERIAL PRIMARY KEY,
      address inet NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Created subnets table');
};
