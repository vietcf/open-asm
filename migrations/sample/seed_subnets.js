// Seed data for subnets table
const { pool } = require('../config/config');

async function seedSubnets() {
  await pool.query(`
    INSERT INTO subnets (address, description) VALUES
      ('192.168.1.0/24', 'Office LAN'),
      ('10.0.0.0/16', 'Datacenter'),
      ('172.16.0.0/12', 'Internal network'),
      ('192.168.100.0/24', 'Guest WiFi'),
      ('192.168.2.0/24', 'Branch office')
    ON CONFLICT (address) DO NOTHING;
  `);
  console.log('Seeded subnets table');
}

if (require.main === module) {
  seedSubnets().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = seedSubnets;
