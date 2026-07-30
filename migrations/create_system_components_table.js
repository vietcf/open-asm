// Migration for creating system_components table
export default async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_components (
      id SERIAL PRIMARY KEY,
      system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      app_type VARCHAR(128),
      fqdn TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(128)
    );
  `);

  // A component name only needs to be unique within its own system.
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_system_component_name
    ON system_components (system_id, LOWER(name));
  `);

  // system_component_contact: many-to-many between system_components and contacts
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_component_contact (
      component_id INTEGER NOT NULL REFERENCES system_components(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (component_id, contact_id)
    );
  `);

  // system_component_ip: many-to-many between system_components and ip_addresses
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_component_ip (
      component_id INTEGER NOT NULL REFERENCES system_components(id) ON DELETE CASCADE,
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      PRIMARY KEY (component_id, ip_id)
    );
  `);
};
