// Adds LDAP (Active Directory) authentication support alongside the existing
// local bcrypt accounts. auth_source marks which path verifyCredentials()
// takes for a user; password_hash must become nullable since LDAP-authenticated
// accounts never store a local password.
export default async (pool) => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_source VARCHAR(20) NOT NULL DEFAULT 'local';
  `);
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_auth_source_check CHECK (auth_source IN ('local', 'ldap'));
  `).catch((err) => {
    // Constraint already exists from a previous run of this migration.
    if (err.code !== '42710') throw err;
  });
  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;
  `);
};
