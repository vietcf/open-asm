// filepath: migrations/create_priv_permissions_table.js
export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS priv_permissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      system_id INTEGER NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      UNIQUE (name, system_id)
    );
  `);
};
