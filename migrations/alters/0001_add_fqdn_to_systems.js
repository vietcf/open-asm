// Adds the fqdn column to systems. Already part of the create_systems_table.js
// baseline for fresh installs — this file only matters for databases created
// before that column existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS fqdn text[] DEFAULT '{}';`);
  console.log('Added fqdn column to systems table!');
};
