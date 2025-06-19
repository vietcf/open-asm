module.exports = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL UNIQUE,
      description TEXT
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tag_object (
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      object_type VARCHAR(32) NOT NULL,
      object_id INTEGER NOT NULL,
      PRIMARY KEY (tag_id, object_type, object_id)
    );
  `);
};
