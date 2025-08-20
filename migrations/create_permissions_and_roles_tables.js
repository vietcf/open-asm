// Create permissions, roles, role_permissions tables
export default async (pool) => {
  // Create permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );
  `);

  // Create roles table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );
  `);

  // Create role_permissions (many-to-many)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INT REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE (role_id, permission_id)
    );
  `);
};
