// Adds updated_at/updated_by to subnets. Already part of the
// create_subnets_table.js baseline for fresh installs — this file only
// matters for databases created before those columns existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE subnets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
  console.log('Added updated_at column to subnets table!');
  await pool.query(`ALTER TABLE subnets ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255) DEFAULT NULL;`);
  console.log('Added updated_by column to subnets table!');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subnets_updated_at ON subnets (updated_at DESC);`);
  console.log('Created index on updated_at column!');
};
