import { pool } from '../config/config.js';
import createUsersTable from './create_users_table.js';
import createIpAddressesTable from './create_ip_addresses_table.js';
import createSubnetsTable from './create_subnets_table.js';
import createServersTable from './create_servers_table.js';
import createContactsTable from './create_contacts_table.js';
import createUnitsTable from './create_units_table.js';
import createPlatformsTable from './create_platforms_table.js';
import createSystemsTable from './create_systems_table.js';
import createAgentsTable from './create_agents_table.js';
import createServicesTable from './create_services_table.js';
import createDomainsTable from './create_domains_table.js';
import createPermissionsAndRolesTables from './create_permissions_and_roles_tables.js';
import createDeviceTypesTable from './create_device_types_table.js';
import createFileUploadsTable from './create_file_uploads_table.js';
import createTagsTable from './create_tags_table.js';
import createDevicesTable from './create_devices_table.js';
import createPrivUsersTable from './create_priv_users_table.js';
import createPrivRolesTable from './create_priv_roles_table.js';
import createPrivPermissionsTable from './create_priv_permissions_table.js';
import createPrivUserRolesTable from './create_priv_user_roles_table.js';
import createPrivRolePermissionsTable from './create_priv_role_permissions_table.js';
import createConfigurationTable from './create_configuration_table.js';
import createSystemLogTable from './create_system_log_table.js';
import createRuleFirewallTable from './create_rulefirewall_table.js';
// Add more migration files here as needed

async function createTables() {
  try {
    console.log('Creating tables...');
    // Đảm bảo thứ tự tạo bảng đúng phụ thuộc khóa ngoại
    await createPermissionsAndRolesTables(pool); // roles, permissions, role_permissions
    await createUsersTable(pool); // users (phụ thuộc roles)
    await createAgentsTable(pool);
    await createServicesTable(pool);
    await createUnitsTable(pool);
    await createContactsTable(pool);
    await createServersTable(pool);
    await createTagsTable(pool); // tags phải tạo trước ip_addresses
    await createIpAddressesTable(pool);
    await createDomainsTable(pool);
    await createSubnetsTable(pool);
    await createPlatformsTable(pool);
    await createSystemsTable(pool);
    await createDeviceTypesTable(pool);
    await createFileUploadsTable(pool);
    await createDevicesTable(pool);
    await createPrivRolesTable(pool); // priv_roles phải tạo trước priv_users
    await createPrivUsersTable(pool);
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
