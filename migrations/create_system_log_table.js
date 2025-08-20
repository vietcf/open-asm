export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_log (
      id SERIAL PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      object_type VARCHAR(100),
      object_id VARCHAR(100),
      description TEXT,
      user_id INTEGER,
      username VARCHAR(100),
      ip_address VARCHAR(50),
      user_agent TEXT,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
