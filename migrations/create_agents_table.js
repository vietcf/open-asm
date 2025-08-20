export default async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      version VARCHAR(50),
      description TEXT
    );
  `);
};