// Adds updated_at to contacts. Already part of the create_contacts_table.js
// baseline for fresh installs — this file only matters for databases created
// before that column existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
  console.log('Added updated_at column to contacts table!');
};
