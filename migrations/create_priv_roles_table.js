// filepath: migrations/create_priv_roles_table.js
module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS priv_roles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_id INT REFERENCES systems(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      CONSTRAINT uniq_priv_role_name_system UNIQUE (name, system_id)
    );
  `);
};
