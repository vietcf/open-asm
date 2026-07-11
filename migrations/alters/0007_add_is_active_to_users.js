// Adds is_active to users. Already part of the create_users_table.js baseline
// for fresh installs — this file only matters for databases created before
// that column existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`);
  console.log('Added is_active column to users table!');
  await pool.query(`UPDATE users SET is_active = TRUE WHERE is_active IS NULL;`);
  console.log('Updated existing users to be active!');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);`);
  console.log('Created index on is_active column!');
};
