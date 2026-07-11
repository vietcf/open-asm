// Adds zone/environment to subnets. Already part of the create_subnets_table.js
// baseline for fresh installs — this file only matters for databases created
// before those columns existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE subnets ADD COLUMN IF NOT EXISTS zone VARCHAR(255) DEFAULT NULL;`);
  console.log('Added zone column to subnets table!');
  await pool.query(`ALTER TABLE subnets ADD COLUMN IF NOT EXISTS environment VARCHAR(255) DEFAULT NULL;`);
  console.log('Added environment column to subnets table!');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subnets_zone ON subnets (zone);`);
  console.log('Created index on zone column!');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subnets_environment ON subnets (environment);`);
  console.log('Created index on environment column!');
};
