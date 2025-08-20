// Migration script to create domains table
export default async (db) => {
  // Create domains table
  await db.query(`
    CREATE TABLE IF NOT EXISTS domains (
      id SERIAL PRIMARY KEY,
      domain VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      ip_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL,
      record_type VARCHAR(16)
    );
  `);
};
