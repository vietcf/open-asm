module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platforms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};