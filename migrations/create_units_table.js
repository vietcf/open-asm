module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(20),
      description VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};