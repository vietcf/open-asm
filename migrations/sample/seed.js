import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../config/config.js';
import seedUsers from './seed_users.js';
import seedIpAddresses from './seed_ip_addresses.js';
import seedSubnets from './seed_subnets.js';
import seedServers from './seed_servers.js';
import seedContacts from './seed_contacts.js';
import seedUnits from './seed_units.js';
import seedPlatforms from './seed_platforms.js';
import seedSystems from './seed_systems.js';
import seedAgents from './seed_agents.js';
import seedServices from './seed_services.js';
import seedDomains from './seed_domains.js';
import seedPermissionsAndRoles from './seed_permissions_and_roles.js';
import seedDeviceTypes from './seed_device_types.js';
import seedTags from './seed_tags.js';
import seedDevices from './seed_devices.js';
import seedPrivUsers from './seed_priv_users.js';
import seedPrivRoles from './seed_priv_roles.js';
import seedPrivPermissions from './seed_priv_permissions.js';
import seedPrivUserRoles from './seed_priv_user_roles.js';
import seedPrivRolePermissions from './seed_priv_role_permissions.js';
import seedRuleFirewall from './seed_rulefirewall.js';
// Add more seed files here as needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    await seedTags(pool);
    await seedIpAddresses(pool);
    await seedDomains(pool);
    await seedSubnets(pool);
    await seedPlatforms(pool);
    await seedSystems(pool);
    await seedDeviceTypes(pool);
    await seedDevices(pool);
    // Privilege tables: seed roles and permissions first, then users, then user_roles and role_permissions
    await seedPrivRoles(pool);
    await seedPrivPermissions(pool);
    await seedPrivUsers(pool);
    await seedPrivUserRoles(pool);
    await seedPrivRolePermissions(pool);
    // await seedTagObject(pool); // Uncomment if you want to seed tag_object
    // Seed firewall rules
    await seedRuleFirewall(pool);
    console.log('Seeding completed.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

seedData();
