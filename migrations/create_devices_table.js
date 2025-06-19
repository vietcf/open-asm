// migrations/create_devices_table.js
module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      serial_number VARCHAR(100),
      device_type_id INTEGER REFERENCES device_types(id) ON DELETE SET NULL,
      platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
      location TEXT,
      management_address VARCHAR(255),
      description TEXT,
      manufacturer VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );
  `);
  // Device-Contact many-to-many relationship
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_contact (
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (device_id, contact_id)
    );
  `);
  // Add device_id to ip_addresses for one-to-many relationship (one device, many IPs)
  await pool.query(`
    ALTER TABLE ip_addresses
    ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL;
  `);
};
