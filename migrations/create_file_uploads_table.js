export default async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_uploads (
      id SERIAL PRIMARY KEY,
      object_type VARCHAR(50) NOT NULL, -- system, server, user, ...
      object_id INTEGER NOT NULL,       -- id of the linked object
      original_name VARCHAR(255) NOT NULL, -- original file name
      file_path VARCHAR(255) NOT NULL,     -- file path on server
      mime_type VARCHAR(100),
      size BIGINT,
      uploaded_by INTEGER,                 -- user id
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
