// Adds raw_data to rulefirewall. Already part of the
// create_rulefirewall_table.js baseline for fresh installs — this file only
// matters for databases created before that column existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE rulefirewall ADD COLUMN IF NOT EXISTS raw_data TEXT DEFAULT NULL;`);
  console.log('Added raw_data column to rulefirewall table!');
};
