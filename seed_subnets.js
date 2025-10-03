import { pool } from './config/config.js';

async function seedSubnets() {
  try {
    console.log('Seeding subnets...');
    
    await pool.query(`
      INSERT INTO subnets (address, description, zone, environment) VALUES
        ('192.168.1.0/24', 'Office LAN', 'OFFICE', 'PROD'),
        ('10.0.0.0/16', 'Datacenter', 'DATACENTER', 'PROD'),
        ('10.1.0.0/16', 'Backbone Network', 'BACKBONE', 'DEV'),
        ('172.16.0.0/12', 'Internal network', 'DMZ', 'UAT'),
        ('192.168.100.0/24', 'Guest WiFi', 'GUEST', 'PROD'),
        ('192.168.2.0/24', 'Branch office', 'BRANCH', 'PROD'),
        ('10.2.0.0/16', 'Development Network', 'DEV_ZONE', 'DEV'),
        ('172.20.0.0/16', 'Testing Network', 'TEST_ZONE', 'TEST')
      ON CONFLICT (address) DO NOTHING;
    `);
    
    console.log('Subnets seeded successfully!');
    
    // Check what we have
    const result = await pool.query('SELECT * FROM subnets ORDER BY address');
    console.log('Current subnets in database:');
    result.rows.forEach(row => {
      console.log(`- ${row.address} (${row.zone}/${row.environment}) - ${row.description}`);
    });
    
  } catch (err) {
    console.error('Error seeding subnets:', err);
  } finally {
    await pool.end();
  }
}

seedSubnets();

