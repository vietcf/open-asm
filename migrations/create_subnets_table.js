// Migration for subnets table
const { pool } = require('../config/config');

async function createSubnetsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subnets (
      id SERIAL PRIMARY KEY,
      address inet NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Created subnets table');
}

if (require.main === module) {
  createSubnetsTable().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = createSubnetsTable;
