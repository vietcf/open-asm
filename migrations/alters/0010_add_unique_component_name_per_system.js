// Enforces that a component name is unique within its own system. Already
// part of the create_system_components_table.js baseline for fresh installs —
// this file only matters for databases created before this index existed.
export default async (pool) => {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_system_component_name
    ON system_components (system_id, LOWER(name));
  `);
  console.log('Created unique index on system_components (system_id, LOWER(name))!');
};
