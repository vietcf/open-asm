// Migration for creating servers table
// Updated: 02/06/2025 - Remove ip from servers, add server_id to ip_addresses (link IP to server)
// Updated: 02/07/2025 - Add status column to servers table
module.exports = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      os_id INTEGER,
      location TEXT,
      type TEXT,
      status VARCHAR(16) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );
  `);
  // Bảng liên kết server - contact (nhiều-nhiều)
  await db.query(`
    CREATE TABLE IF NOT EXISTS server_contact (
      server_id INTEGER,
      contact_id INTEGER,
      PRIMARY KEY (server_id, contact_id)
    );
  `);
  // Bảng liên kết server - system (nhiều-nhiều)
  await db.query(`
    CREATE TABLE IF NOT EXISTS server_system (
      server_id INTEGER,
      system_id INTEGER,
      PRIMARY KEY (server_id, system_id)
    );
  `);
  // Bảng liên kết server - agent (nhiều-nhiều)
  await db.query(`
    CREATE TABLE IF NOT EXISTS server_agents (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      PRIMARY KEY (server_id, agent_id)
    );
  `);
  // Bảng liên kết server - service (nhiều-nhiều)
  await db.query(`
    CREATE TABLE IF NOT EXISTS server_services (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      PRIMARY KEY (server_id, service_id)
    );
  `);
  // Remove the server_ip table if it exists (no longer needed)
  await db.query('DROP TABLE IF EXISTS server_ip CASCADE;');
};
