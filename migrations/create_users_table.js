export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(100) UNIQUE,
      fullname VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      role_id INT REFERENCES roles(id),
      twofa_secret VARCHAR(64),
      twofa_enabled BOOLEAN DEFAULT FALSE,
      require_twofa BOOLEAN DEFAULT FALSE,
      twofa_setup_deadline TIMESTAMP,
      must_change_password BOOLEAN DEFAULT FALSE
    );
  `);
};