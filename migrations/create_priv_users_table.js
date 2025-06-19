// filepath: migrations/create_priv_users_table.js
module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS priv_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      organize_id INT REFERENCES units(id),
      role_id INT REFERENCES priv_roles(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      account_type VARCHAR(255) NOT NULL,
      manage_type VARCHAR(255) NOT NULL,
      app_url VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS priv_user_contacts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      contact_id INT REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS priv_user_systems (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS priv_user_servers (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      server_id INT REFERENCES servers(id) ON DELETE CASCADE
    );
  `);
};
