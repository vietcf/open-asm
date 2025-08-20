// Migration for creating ip_addresses table
// Updated: 02/06/2025 - Use INET type for address, address UNIQUE
export default async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ip_addresses (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(64) NOT NULL UNIQUE,
      description TEXT,
      server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
      status VARCHAR(32),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(128)
    );
  `);

  // Create the many-to-many relationship table between ip_addresses and tags
  await db.query(`
    CREATE TABLE IF NOT EXISTS ip_tag (
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (ip_id, tag_id)
    );
  `);

  // Create the many-to-many relationship table between ip_addresses and contacts
  await db.query(`
    CREATE TABLE IF NOT EXISTS ip_contact (
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (ip_id, contact_id)
    );
  `);
};