// Adds a free-text Server Role column to servers, mirroring devices.device_role
// (create_servers_table.js already ran on deployed DBs, so this is an ALTER).
export default async (pool) => {
  await pool.query(`
    ALTER TABLE servers
    ADD COLUMN IF NOT EXISTS server_role VARCHAR(255);
  `);
};
