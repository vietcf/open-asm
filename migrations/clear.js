const { pool } = require('../config/config');
const clearAllTables = require('./clear_all_tables');
const clearPrivRolePermissions = require('./clear_priv_role_permissions');
const clearPrivUserRoles = require('./clear_priv_user_roles');
const clearPrivPermissions = require('./clear_priv_permissions');
const clearPrivRoles = require('./clear_priv_roles');
const clearPrivUsers = require('./clear_priv_users');

(async () => {
  try {
    await clearAllTables(pool);
    console.log('All tables cleared!');
    await clearPrivRolePermissions(pool);
    await clearPrivUserRoles(pool);
    await clearPrivPermissions(pool);
    await clearPrivRoles(pool);
    await clearPrivUsers(pool);
    // Clear firewall rule tables
    await pool.query('DELETE FROM rulefirewall_contact');
    await pool.query('DELETE FROM rulefirewall');
  } catch (err) {
    console.error('Error clearing tables:', err);
  } finally {
    await pool.end();
  }
})();
