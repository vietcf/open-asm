// Migration for creating the `systems` table and related many-to-many relationship tables
export default async (db) => {
  // Create the `systems` table
  await db.query(`
    CREATE TABLE IF NOT EXISTS systems (
      id SERIAL PRIMARY KEY,
      system_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) UNIQUE NOT NULL,
      level VARCHAR(50),
      department_id INT REFERENCES units(id),
      alias TEXT[],
      fqdn TEXT[],
      description TEXT,
      scopes JSONB DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255)
    );
  `);

  // Create the many-to-many relationship table between `systems` and `servers`
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_server (
      id SERIAL PRIMARY KEY,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE,
      server_id INT REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  // Create the many-to-many relationship table between `systems` and `ip_addresses`
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_ip (
      id SERIAL PRIMARY KEY,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE,
      ip_id INT REFERENCES ip_addresses(id) ON DELETE CASCADE
    );
  `);

  // Create the many-to-many relationship table between `systems` and `contacts`
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_contact (
      id SERIAL PRIMARY KEY,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE,
      contact_id INT REFERENCES contacts(id) ON DELETE CASCADE
    );
  `);

  // Create the many-to-many relationship table between `systems` and `domains`
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_domain (
      system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      PRIMARY KEY (system_id, domain_id)
    );
  `);

  // Create GIN index for JSONB scopes column for efficient querying
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_systems_scopes ON systems USING GIN (scopes);
  `);
};
