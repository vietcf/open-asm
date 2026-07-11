// Adds device_role to devices. Already part of the create_devices_table.js
// baseline for fresh installs — this file only matters for databases created
// before that column existed.
export default async (pool) => {
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_role VARCHAR(255) DEFAULT NULL;`);
  console.log('Added device_role column to devices table!');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_devices_device_role ON devices (device_role);`);
  console.log('Created index on device_role column!');
};
