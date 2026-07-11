// Adds the architecture column to systems. Already part of the
// create_systems_table.js baseline for fresh installs — this file only
// matters for databases created before that column existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS architecture JSONB DEFAULT NULL;`);
  console.log('Added architecture column to systems table!');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_systems_architecture ON systems USING GIN (architecture);`);
  console.log('Created GIN index on architecture column!');
};
