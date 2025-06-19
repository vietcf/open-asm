const { pool } = require('../config/config');
const seedUsers = require('./seed_users');
const seedIpAddresses = require('./seed_ip_addresses');
const seedSubnets = require('./seed_subnets');
const seedServers = require('./seed_servers');
const seedContacts = require('./seed_contacts');
const seedUnits = require('./seed_units');
const seedPlatforms = require('./seed_platforms');
const seedSystems = require('./seed_systems');
const seedAgents = require('./seed_agents');
const seedServices = require('./seed_services');
const seedDomains = require('./seed_domains');
const seedPermissionsAndRoles = require('./seed_permissions_and_roles');
const seedDeviceTypes = require('./seed_device_types');
const seedTags = require('./seed_tags');
const seedDevices = require('./seed_devices');
const seedPrivUsers = require('./seed_priv_users');
const seedPrivRoles = require('./seed_priv_roles');
const seedPrivPermissions = require('./seed_priv_permissions');
const seedPrivUserRoles = require('./seed_priv_user_roles');
const seedPrivRolePermissions = require('./seed_priv_role_permissions');
// Add more seed files here as needed

async function seedData() {
  try {
    console.log('Seeding data...');
    await seedPermissionsAndRoles(pool);
    await seedAgents(pool);
    await seedServices(pool);
    await seedUsers(pool);
    await seedUnits(pool);
    await seedContacts(pool);
    await seedServers(pool);
    await seedIpAddresses(pool);
    await seedDomains(pool);
    await seedSubnets(pool);
    await seedPlatforms(pool);
    await seedSystems(pool);
    await seedDeviceTypes(pool);
    await seedTags(pool);
    await seedDevices(pool);
    // Privilege tables: seed roles and permissions first, then users, then user_roles and role_permissions
    await seedPrivRoles(pool);
    await seedPrivPermissions(pool);
    await seedPrivUsers(pool);
    await seedPrivUserRoles(pool);
    await seedPrivRolePermissions(pool);
    // await seedTagObject(pool); // Uncomment if you want to seed tag_object
    // Seed firewall rules
    await require('./seed_rulefirewall')(pool);
    console.log('Seeding completed.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

seedData();
