// migrations/create_rulefirewall_table.js
module.exports = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rulefirewall (
      id SERIAL PRIMARY KEY,
      rulename VARCHAR(255) NOT NULL,
      firewall_name VARCHAR(255),
      src_zone VARCHAR(128),
      src TEXT,
      src_detail TEXT,
      dst_zone VARCHAR(128),
      dst TEXT,
      dst_detail TEXT,
      services VARCHAR(255),
      application VARCHAR(255),
      url VARCHAR(255),
      action VARCHAR(32) NOT NULL,
      violation_type VARCHAR(128),
      violation_detail TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(128),
      ou_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      solution_proposal TEXT,
      solution_confirm TEXT,
      status VARCHAR(64),
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS rulefirewall_contact (
      rule_id INTEGER REFERENCES rulefirewall(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, contact_id)
    );
  `);
};
