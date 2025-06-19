const { pool } = require('../config/config');
const createUsersTable = require('./create_users_table');
const createIpAddressesTable = require('./create_ip_addresses_table');
const createSubnetsTable = require('./create_subnets_table');
const createServersTable = require('./create_servers_table');
const createContactsTable = require('./create_contacts_table');
const createUnitsTable = require('./create_units_table');
const createPlatformsTable = require('./create_platforms_table');
const createSystemsTable = require('./create_systems_table');
const createAgentsTable = require('./create_agents_table');
const createServicesTable = require('./create_services_table');
const createDomainsTable = require('./create_domains_table');
const createPermissionsAndRolesTables = require('./create_permissions_and_roles_tables');
const createDeviceTypesTable = require('./create_device_types_table');
const createFileUploadsTable = require('./create_file_uploads_table');
const createTagsTable = require('./create_tags_table');
const createDevicesTable = require('./create_devices_table');
const createPrivUsersTable = require('./create_priv_users_table');
const createPrivRolesTable = require('./create_priv_roles_table');
const createPrivPermissionsTable = require('./create_priv_permissions_table');
const createPrivUserRolesTable = require('./create_priv_user_roles_table');
const createPrivRolePermissionsTable = require('./create_priv_role_permissions_table');
const createConfigurationTable = require('./create_configuration_table');
const createSystemLogTable = require('./create_system_log_table');
const createRuleFirewallTable = require('./create_rulefirewall_table');
// Add more migration files here as needed

async function createTables() {
  try {
    console.log('Creating tables...');
    await createUsersTable(pool);
    await createPermissionsAndRolesTables(pool);
    await createAgentsTable(pool);
    await createServicesTable(pool);
    await createUnitsTable(pool);
    await createContactsTable(pool);
    await createServersTable(pool);
    await createIpAddressesTable(pool);
    await createDomainsTable(pool);
    await createSubnetsTable(pool);
    await createPlatformsTable(pool);
    await createSystemsTable(pool);
    await createDeviceTypesTable(pool);
    await createTagsTable(pool);
    await createFileUploadsTable(pool);
    await createDevicesTable(pool);
    await createPrivUsersTable(pool);
    await createPrivRolesTable(pool);
    await createPrivPermissionsTable(pool);
    await createPrivUserRolesTable(pool);
    await createPrivRolePermissionsTable(pool);
    await createConfigurationTable(pool);
    await createSystemLogTable(pool);
    await createRuleFirewallTable(pool);
    console.log('All tables created.');
  } catch (err) {
    console.error('Table creation failed:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

createTables();
