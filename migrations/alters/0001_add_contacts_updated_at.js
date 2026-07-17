// Databases created before the `updated_at` column was added to the
// contacts baseline (migrations/create_contacts_table.js) are missing it,
// causing contact updates to fail with:
// column "updated_at" of relation "contacts" does not exist
export default async (pool) => {
  await pool.query(`
    ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
};
