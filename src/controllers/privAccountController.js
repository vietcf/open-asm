import PrivUser from '../models/PrivUser.js';
import PrivRole from '../models/PrivRole.js';
import PrivPermission from '../models/PrivPermission.js';
import { pool } from '../../config/config.js';
import Configuration from '../models/Configuration.js';
import System from '../models/System.js';
import Unit from '../models/Unit.js';
import Contact from '../models/Contact.js';
import ExcelJS from 'exceljs';
// Helper: load account types from DB config
async function getAccountTypesFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('priv_account_type');
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch { parsed = null; }
      if (parsed) {
        if (Array.isArray(parsed)) {
          options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
        } else if (parsed.types && Array.isArray(parsed.types)) {
          options = parsed.types.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
        }
      } else {
        options = String(config.value).split(',').map(v => ({ value: v.trim(), label: v.trim() })).filter(x => x.value);
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [
      { value: 'OS', label: 'Operating System (OS)' },
      { value: 'APP', label: 'Application (APP)' },
      { value: 'DB', label: 'Database (DB)' }
    ];
  }
  return options;
}

async function getManageTypesFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('priv_account_manage_type');
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch { parsed = null; }
      if (parsed) {
        if (Array.isArray(parsed)) {
          options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
        } else if (parsed.manageTypes && Array.isArray(parsed.manageTypes)) {
          options = parsed.manageTypes.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
        }
      } else {
        options = String(config.value).split(',').map(v => ({ value: v.trim(), label: v.trim() })).filter(x => x.value);
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [
      { value: 'SELF', label: 'Self-managed' },
      { value: 'PAM', label: 'Managed by PAM' },
      { value: 'ENVELOPE', label: 'Envelope method' }
    ];
  }
  return options;
}
import { clearPermissionsCache } from '../middlewares/permissions.middleware.js';

const privAccountController = {};

// Render Privileged Account List page with layout 
privAccountController.listAccounts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let pageSize = parseInt(req.query.pageSize) || res.locals.defaultPageSize;
    
    // Use global pageSizeOptions from res.locals (set in app.js)
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }

    // Get filter parameters
    const search = req.query.search ? req.query.search.trim() : '';
    let system_ids = req.query['system_ids[]'] || req.query.system_ids || [];
    if (!Array.isArray(system_ids)) system_ids = system_ids ? [system_ids] : [];
    const organize_id = req.query.organize_id ? req.query.organize_id.trim() : '';
    let contact_ids = req.query['contact_ids[]'] || req.query.contact_ids || [];
    if (!Array.isArray(contact_ids)) contact_ids = contact_ids ? [contact_ids] : [];


    // Use model methods for all DB logic
    const totalCount = await PrivUser.countFilteredList({ search, system_ids, organize_id, contact_ids });
    const privUserList = await PrivUser.findFilteredList({ search, system_ids, organize_id, contact_ids, page, pageSize });

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);

    // Load selected filters for re-populating the filter form (refactored, only if needed)
    const selectedSystems = system_ids.length ? (await System.findByIds(system_ids)) : [];
    const selectedOrganize = organize_id ? (await Unit.findById(organize_id)) : null;
    const selectedContacts = contact_ids.length ? (await Contact.findByIds(contact_ids)) : [];

    const success = req.flash ? req.flash('success')[0] : (req.query.success || null);
    const error = req.flash ? req.flash('error')[0] : (req.query.error || null);
    
    res.render('pages/privilege/priv_account_list', {
      privUserList,
      page,
      totalPages,
      pageSize,
      search,
      success,
      error,
      system_ids,
      system_names: selectedSystems.map(s => s.name),
      organize_id: selectedOrganize ? selectedOrganize.id : '',
      organize_name: selectedOrganize ? selectedOrganize.name : '',
      contact_ids,
      contact_names: selectedContacts.map(c => c.name),
  accountTypes: await getAccountTypesFromConfig(),
  manageTypes: await getManageTypesFromConfig(),
      startItem,
      endItem,
      totalCount,
      // allowedPageSizes: res.locals.pageSizeOptions, // Không cần truyền, đã có global
      title: 'Privileged Account',
      activeMenu: 'priv-account-list'
    });
  } catch (err) {
    console.error('Error loading privileged accounts:', err);
    res.status(500).send('Error loading privileged accounts: ' + err.message);
  }
};

// Handle creating a new privileged account (with all associations)
privAccountController.createAccount = async (req, res) => {
  // Extract and normalize form fields
  let {
    username,
    description,
    organize_id,
    role_id,
    account_type,
    manage_type,
    app_url
  } = req.body;
  username = typeof username === 'string' ? username : '';
  description = typeof description === 'string' ? description : '';
  organize_id = organize_id || '';
  role_id = role_id || '';
  account_type = account_type || '';
  manage_type = manage_type || '';
  app_url = typeof app_url === 'string' ? app_url : '';

  // Multi-selects: ensure always array
  let contacts = req.body['contacts[]'] || req.body.contacts || [];
  let system_ids = req.body['system_ids[]'] || req.body.system_ids || [];
  let server_ids = req.body['server_ids[]'] || req.body.server_ids || [];
  if (!Array.isArray(contacts)) contacts = contacts ? [contacts] : [];
  if (!Array.isArray(system_ids)) system_ids = system_ids ? [system_ids] : [];
  if (!Array.isArray(server_ids)) server_ids = server_ids ? [server_ids] : [];

  // Validate required fields
  const errors = [];
  if (!username.trim()) errors.push('Account Name is required.');
  if (!organize_id) errors.push('Organize Unit is required.');
  if (!role_id) errors.push('Role is required.');
  // Validate account_type and manage_type against config
  const allowedAccountTypes = (await getAccountTypesFromConfig()).map(opt => opt.value);
  const allowedManageTypes = (await getManageTypesFromConfig()).map(opt => opt.value);
  if (!account_type) {
    errors.push('Account Type is required.');
  } else if (!allowedAccountTypes.includes(account_type)) {
    errors.push('Invalid Account Type.');
  }
  if (!manage_type) {
    errors.push('Management Method is required.');
  } else if (!allowedManageTypes.includes(manage_type)) {
    errors.push('Invalid Management Method.');
  }
  if (!contacts.length) errors.push('At least one Contact is required.');
  if (!system_ids.length) errors.push('At least one System is required.');
  if (account_type === 'OS' || account_type === 'DB') {
    if (!server_ids.length) errors.push('At least one Server is required for OS/DB account type.');
    app_url = null;
  } else if (account_type === 'APP') {
    if (!app_url) errors.push('Application URL is required for APP account type.');
    server_ids = [];
  } else {
    app_url = null;
    server_ids = [];
  }

  if (errors.length) {
    req.flash && req.flash('error', errors.join(' '));
    req.session.formData = {
      username, description, organize_id, role_id, account_type, manage_type, app_url,
      contacts, system_ids, server_ids
    };
    return res.redirect('/priv-account/account');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Create main user (priv_users)
    const account = await PrivUser.create({
      username,
      description,
      organize_id,
      role_id,
      account_type,
      manage_type,
      app_url,
      updated_by: req.session.user?.username || username,
      client
    });
    // Add relationships
    await PrivUser.addContacts(account.id, contacts, client);
    await PrivUser.addSystems(account.id, system_ids, client);
    if (account_type === 'OS' || account_type === 'DB') {
      await PrivUser.addServers(account.id, server_ids, client);
    }
    await client.query('COMMIT');
    req.flash && req.flash('success', 'Privileged account added successfully!');
    res.redirect('/priv-account/account');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash && req.flash('error', err.message || 'Add failed.');
    res.redirect('/priv-account/account');
  } finally {
    client.release();
  }
};

// Handle updating a privileged user
privAccountController.updateAccount = async (req, res) => {
  // Extract and normalize form fields
  let {
    username,
    description,
    organize_id,
    role_id,
    account_type,
    manage_type,
    app_url
  } = req.body;
  username = typeof username === 'string' ? username : '';
  description = typeof description === 'string' ? description : '';
  organize_id = organize_id || '';
  role_id = role_id || '';
  account_type = account_type || '';
  manage_type = manage_type || '';
  app_url = typeof app_url === 'string' ? app_url : '';

  // Multi-selects: ensure always array
  let contacts = req.body['contacts[]'] || req.body.contacts || [];
  let system_ids = req.body['system_ids[]'] || req.body.system_ids || [];
  let server_ids = req.body['server_ids[]'] || req.body.server_ids || [];
  if (!Array.isArray(contacts)) contacts = contacts ? [contacts] : [];
  if (!Array.isArray(system_ids)) system_ids = system_ids ? [system_ids] : [];
  if (!Array.isArray(server_ids)) server_ids = server_ids ? [server_ids] : [];

  // Validate required fields
  const errors = [];
  if (!username.trim()) errors.push('Account Name is required.');
  if (!organize_id) errors.push('Organize Unit is required.');
  if (!role_id) errors.push('Role is required.');
  // Validate account_type and manage_type against config
  const allowedAccountTypes = (await getAccountTypesFromConfig()).map(opt => opt.value);
  const allowedManageTypes = (await getManageTypesFromConfig()).map(opt => opt.value);
  if (!account_type) {
    errors.push('Account Type is required.');
  } else if (!allowedAccountTypes.includes(account_type)) {
    errors.push('Invalid Account Type.');
  }
  if (!manage_type) {
    errors.push('Management Method is required.');
  } else if (!allowedManageTypes.includes(manage_type)) {
    errors.push('Invalid Management Method.');
  }
  if (!contacts.length) errors.push('At least one Contact is required.');
  if (!system_ids.length) errors.push('At least one System is required.');
  if (account_type === 'OS' || account_type === 'DB') {
    if (!server_ids.length) errors.push('At least one Server is required for OS/DB account.');
    app_url = null;
  } else if (account_type === 'APP') {
    if (!app_url || !app_url.trim()) errors.push('Application URL is required for APP account.');
    server_ids = [];
  } else {
    app_url = null;
    server_ids = [];
  }

  if (errors.length) {
    req.flash && req.flash('error', errors.join(' '));
    req.session.formData = {
      username, description, organize_id, role_id, account_type, manage_type, app_url,
      contacts, system_ids, server_ids
    };
    return res.redirect('/priv-account/account');
  }

  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Update main user (priv_users) via model method
    await PrivUser.update(id, {
      username,
      description,
      organize_id,
      role_id,
      account_type,
      manage_type,
      app_url,
      updated_by: req.session.user?.username || username,
      client
    });
    // Set associations using model set* helpers
    await PrivUser.setContacts(id, contacts, client);
    await PrivUser.setSystems(id, system_ids, client);
    if (account_type === 'OS' || account_type === 'DB') {
      await PrivUser.setServers(id, server_ids, client);
    } else {
      // Always clear servers if not OS/DB
      await PrivUser.setServers(id, [], client);
    }
    await client.query('COMMIT');
    req.flash && req.flash('success', 'Privileged account updated successfully!');
    res.redirect('/priv-account/account');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash && req.flash('error', err.message || 'Update failed.');
    res.redirect('/priv-account/account');
  } finally {
    client.release();
  }
};

// Handle deleting a privileged user
privAccountController.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    await PrivUser.remove(id);
    req.flash && req.flash('success', 'Privileged user deleted successfully!');
    res.redirect('/priv-account/account');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Delete failed.');
    res.redirect('/priv-account/account');
  }
};

// API: Get account details for edit modal (AJAX)
privAccountController.getAccountDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await PrivUser.findByIdWithDetails(id);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load account details' });
  }
};

//------------------------------------------------------
//PRIVIGED ROLE CONTROLLER
//------------------------------------------------------
// Render Privileged Role List page with layout
privAccountController.listRoles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let pageSize = parseInt(req.query.pageSize) || res.locals.defaultPageSize;
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    const search = req.query.search ? req.query.search.trim() : '';
    const system_id = req.query.system_id ? req.query.system_id.trim() : '';

    // Use model methods for filter and count
    const privRoleList = await PrivRole.findFilteredList({ search, system_id, page, pageSize });
    const totalCount = await PrivRole.countFilteredList({ search, system_id });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    // Calculate summary range for 'Showing x - y of z' display
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);
    // Load all permissions
    const allPermissions = await PrivPermission.findAll();
    // Attach permissions to each role
    for (const role of privRoleList) {
      role.permissions = await PrivRole.findPermissions(role.id);
    }
    // Persist filter values for modal
    let system_name = '';
    if (system_id && privRoleList.length > 0 && privRoleList[0].system && privRoleList[0].system.name) {
      system_name = privRoleList[0].system.name;
    }
    const success = req.flash ? req.flash('success')[0] : (req.query.success || null);
    const error = req.flash ? req.flash('error')[0] : (req.query.error || null);

    res.render('pages/privilege/priv_role_list', {
      privRoleList,
      page,
      totalPages,
      pageSize,
      search,
      system_id,
      system_name,
      success,
      error,
      allPermissions,
      startItem,
      endItem,
      totalCount,
      allowedPageSizes: res.locals.pageSizeOptions,
      title: 'Privileged Role List',
      activeMenu: 'priv-role-list'
    });
  } catch (err) {
    console.error('Error loading privileged roles:', err);
    res.status(500).send('Error loading privileged roles: ' + err.message);
  }
};   
    

// Handle creating a new privileged role
privAccountController.createRole = async (req, res) => {
  try {
    // Normalize and trim input fields
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    let system_id = req.body.system_id;
    if (typeof system_id === 'string') system_id = system_id.trim();
    let permissions = req.body.permissions;
    if (!permissions) permissions = [];
    if (!Array.isArray(permissions)) permissions = [permissions];
    const updated_by = req.session.user?.username || '';
    // Validate required fields
    const errors = [];
    if (!name) errors.push('Role name is required!');
    if (!system_id) errors.push('System is required!');
    if (errors.length) {
      req.flash && req.flash('error', errors.join(' '));
      return res.redirect('/priv-account/role');
    }
    // Create role with system_id
    const newRole = await PrivRole.create({ name, description, system_id, updated_by });
    await PrivRole.setPermissions(newRole.id, permissions.map(Number));
    
    // Clear permissions cache since new role with permissions was created
    clearPermissionsCache();
    
    req.flash && req.flash('success', 'Privileged role added successfully!');
    res.redirect('/priv-account/role');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Add failed.');
    res.redirect('/priv-account/role');
  }
};

// Handle updating a privileged role
privAccountController.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    let system_id = req.body.system_id;
    if (typeof system_id === 'string') system_id = system_id.trim();
    let permissions = req.body.permissions;
    if (!permissions) permissions = [];
    if (!Array.isArray(permissions)) permissions = [permissions]; // Ensure always array
    const updated_by = req.session.user?.username || '';
    await PrivRole.update(id, { name, description, system_id, updated_by });
    console.log('Updating permissions for role ID:', id, 'with permissions:', permissions);
    await PrivRole.setPermissions(id, permissions.map(Number));
    
    // Clear permissions cache for all roles since permissions changed
    clearPermissionsCache();
    
    req.flash && req.flash('success', 'Privileged role updated successfully!');
    res.redirect('/priv-account/role');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Update failed.');
    res.redirect('/priv-account/role');
  }
};

// Handle deleting a privileged role
privAccountController.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    await PrivRole.remove(id);
    
    // Clear permissions cache since role was deleted
    clearPermissionsCache();
    
    req.flash && req.flash('success', 'Privileged role deleted successfully!');
    res.redirect('/priv-account/role');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Delete failed.');
    res.redirect('/priv-account/role');
  }
};


//------------------------------------------------------
//PRIVIGED PERMISSION CONTROLLER
//------------------------------------------------------


// Render Privileged Permission List page with layout
privAccountController.listPermissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let pageSize = parseInt(req.query.pageSize) || res.locals.defaultPageSize;
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    const search = req.query.search ? req.query.search.trim() : '';

    // Use model methods for all DB logic
    const totalCount = await PrivPermission.countFiltered({ search });
    const privPermissionList = await PrivPermission.findFilteredList({ search, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Attach system info to each permission
    for (const perm of privPermissionList) {
      perm.system = await System.findById(perm.system_id);
    }

    // Calculate summary range for 'Showing x - y of z' display
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);
    const success = req.flash ? req.flash('success')[0] : (req.query.success || null);
    const error = req.flash ? req.flash('error')[0] : (req.query.error || null);
    let system_name = '';
    if (req.query.system_id && privPermissionList.length > 0 && privPermissionList[0].system && privPermissionList[0].system.name) {
      system_name = privPermissionList[0].system.name;
    }

    res.render('pages/privilege/priv_permission_list', {
      privPermissionList,
      page,
      totalPages,
      pageSize,
      search,
      system_id: req.query.system_id || '',
      system_name,
      success,
      error,
      startItem,
      endItem,
      totalCount,
      allowedPageSizes: res.locals.pageSizeOptions,
      title: 'Privileged Permission List',
      activeMenu: 'priv-permission-list'
    });
  } catch (err) {
    console.error('Error loading privileged permissions:', err);
    res.status(500).send('Error loading privileged permissions: ' + err.message);
  }
};

// Handle creating a new privileged permission
privAccountController.createPermission = async (req, res) => {
  try {
    // Normalize and trim input fields
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    let system_id = req.body.system_id;
    if (typeof system_id === 'string') system_id = system_id.trim();
    if (!name) {
      req.flash && req.flash('error', 'Permission name is required!');
      return res.redirect('/priv-account/permission');
    }
    if (!system_id) {
      req.flash && req.flash('error', 'System is required!');
      return res.redirect('/priv-account/permission');
    }
    const updated_by = req.session.user?.username || '';
    await PrivPermission.create({ name, description, system_id, updated_by });
    req.flash && req.flash('success', 'Privileged permission added successfully!');
    res.redirect('/priv-account/permission');
  } catch (err) {
    if (err.code === '23505') {
      req.flash && req.flash('error', 'A permission with this name already exists for the selected system. Please choose a different name or system.');
    } else {
      req.flash && req.flash('error', err.message || 'Add failed.');
    }
    res.redirect('/priv-account/permission');
  }
};

// Handle updating a privileged permission
privAccountController.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    // Normalize and trim input fields
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    let system_id = req.body.system_id;
    if (typeof system_id === 'string') system_id = system_id.trim();
    if (!name) {
      req.flash && req.flash('error', 'Permission name is required!');
      return res.redirect('/priv-account/permission');
    }
    if (!system_id) {
      req.flash && req.flash('error', 'System is required!');
      return res.redirect('/priv-account/permission');
    }
    const updated_by = req.session.user?.username || '';
    await PrivPermission.update(id, { name, description, system_id, updated_by });
    req.flash && req.flash('success', 'Privileged permission updated successfully!');
    res.redirect('/priv-account/permission');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Update failed.');
    res.redirect('/priv-account/permission');
  }
};

// Handle deleting a privileged permission
privAccountController.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    await PrivPermission.remove(id);
    req.flash && req.flash('success', 'Privileged permission deleted successfully!');
    res.redirect('/priv-account/permission');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Delete failed.');
    res.redirect('/priv-account/permission');
  }
};

// Export privileged permissions to Excel (with filter/search support)
privAccountController.exportPermissions = async (req, res) => {
  try {
    // Debug: kiểm tra query param truyền lên
    // console.log('Export query:', req.query); 
    const search = req.query.search ? req.query.search.trim() : '';
    const system_id = req.query.system_id ? req.query.system_id.trim() : '';
    let where = [];
    let params = [];
    let idx = 1;
    // Đồng bộ thứ tự với listPermissions: search trước, rồi system_id
    if (search) {
      where.push('(name ILIKE $' + idx + ' OR description ILIKE $' + idx + ')');
      params.push(`%${search}%`);
      idx++;
    }
    if (system_id) {
      where.push('system_id = $' + idx);
      params.push(system_id);
      idx++;
    }
    let whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const sql = `SELECT * FROM priv_permissions ${whereClause} ORDER BY id`;
    const { rows } = await pool.query(sql, params);
    for (const perm of rows) {
      perm.system = await System.findById(perm.system_id);
    }
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Privileged Permissions');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Permission Name', key: 'name', width: 32 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'System', key: 'system', width: 24 },
      { header: 'Updated Date', key: 'updated_date', width: 20 },
      { header: 'Updated By', key: 'updated_by', width: 20 },
    ];
    rows.forEach(row => {
      sheet.addRow({
        id: row.id,
        name: row.name,
        description: row.description,
        system: row.system && row.system.name ? row.system.name : '',
        updated_date: row.updated_date ? new Date(row.updated_date).toLocaleString() : '',
        updated_by: row.updated_by || '',
      }).commit();
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="privileged_permissions.xlsx"');
    await sheet.commit();
    await workbook.commit();
  } catch (err) {
    res.status(500).send('Failed to export: ' + err.message);
  }
};

// Export privileged roles to Excel (with filter/search support)
privAccountController.exportRoles = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const system_id = req.query.system_id ? req.query.system_id.trim() : '';
    let where = [];
    let params = [];
    let idx = 1;

    if (search) {
      where.push('(r.name ILIKE $' + idx + ' OR r.description ILIKE $' + idx + ')');
      params.push(`%${search}%`);
      idx++;
    }
    if (system_id) {
      where.push('r.system_id = $' + idx);
      params.push(system_id);
      idx++;
    }

    let whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    let sql = `
      SELECT r.*, s.name as system_name 
      FROM priv_roles r 
      LEFT JOIN systems s ON r.system_id = s.id
      ${whereClause}
      ORDER BY r.id`;

    const { rows } = await pool.query(sql, params);

    // Get permissions for each role
    for (const role of rows) {
      role.permissions = await PrivRole.getPermissions(role.id);
    }

    // Create workbook and add worksheet
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Privileged Roles');

    // Define columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Role Name', key: 'name', width: 32 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'System', key: 'system', width: 24 },
      { header: 'Permissions', key: 'permissions', width: 40 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Updated Date', key: 'updated_date', width: 20 },
      { header: 'Updated By', key: 'updated_by', width: 20 }
    ];

    // Add rows
    rows.forEach(row => {
      sheet.addRow({
        id: row.id,
        name: row.name,
        description: row.description,
        system: row.system_name || '',
        permissions: row.permissions ? row.permissions.map(p => p.name).join(', ') : '',
        created_at: row.created_at ? new Date(row.created_at).toLocaleString() : '',
        updated_date: row.updated_date ? new Date(row.updated_date).toLocaleString() : '',
        updated_by: row.updated_by || ''
      }).commit();
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="privileged_roles.xlsx"');

    // Write workbook to response
    await sheet.commit();
    await workbook.commit();
  } catch (err) {
    console.error('Error exporting privileged roles:', err);
    res.status(500).send('Failed to export: ' + err.message);
  }
};

// AJAX API: Privileged Role search for select2 ajax (role dropdown)
// Used by /priv-account/api/role?search=xxx
privAccountController.apiRoleSearch = async (req, res) => {
  try {
    const search = req.query.search || '';
    let system_ids = req.query.system_ids || [];
    if (typeof system_ids === 'string' && system_ids) system_ids = [system_ids];
    if (!Array.isArray(system_ids)) system_ids = [];
    const roles = await PrivRole.findForSystemSelect2(search, system_ids);
    res.json(roles.map(r => ({ id: r.id, text: r.name })));
  } catch (err) {
    res.status(500).json([]);
  }
};

// AJAX API: Get roles by system(s) only (no search, for select2)
privAccountController.apiRoleBySystem = async (req, res) => {
  try {
    let system_ids = req.body.system_ids || [];
    console.log(system_ids);
    if (!Array.isArray(system_ids)) system_ids = [];
    system_ids = system_ids.filter(x => x !== undefined && x !== null && x !== '');
    if (!system_ids.length) return res.json([]);
    const roles = await PrivRole.findBySystemIds(system_ids);
    res.json(roles.map(r => ({ id: r.id, text: r.name })));
  } catch (err) {
    res.status(500).json([]);
  }
};

// API: Get permissions by system_id (for Privileged Role add form AJAX)
privAccountController.apiPermissionsBySystem = async (req, res) => {
  try {
    const system_id = req.query.system_id;
    if (!system_id) {
      return res.status(400).json({ error: 'system_id is required' });
    }
    const permissions = await PrivPermission.findBySystemId(system_id);
    // Return as [{id, name, description}] for select2 or similar
    res.json(permissions.map(p => ({ id: p.id, name: p.name, description: p.description })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load permissions: ' + err.message });
  }
};


// Export privileged accounts to Excel (with filter/search support)
privAccountController.exportAccounts = async (req, res) => {
  try {
    // Normalize filter parameters from query
    let filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      system_ids: [], 
      organize_id: req.query.organize_id ? req.query.organize_id.trim() : '',
      contact_ids: []
    };
    // Handle system_ids array
    const rawSystemIds = req.query['system_ids[]'] || req.query.system_ids;
    if (rawSystemIds) {
      filterParams.system_ids = Array.isArray(rawSystemIds) ? rawSystemIds : [rawSystemIds];
    }

    // Handle contact_ids array  
    const rawContactIds = req.query['contact_ids[]'] || req.query.contact_ids;
    if (rawContactIds) {
      filterParams.contact_ids = Array.isArray(rawContactIds) ? rawContactIds : [rawContactIds];
    }

    // Build WHERE clause dynamically
    let where = [];
    let params = [];
    let idx = 1;

    // Add search condition
    if (filterParams.search) {
      where.push('(pu.username ILIKE $' + idx + ' OR pu.description ILIKE $' + idx + ')');
      params.push(`%${filterParams.search}%`);
      idx++;
    }

    // Add system_ids condition
    if (filterParams.system_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_systems pus WHERE pus.user_id = pu.id AND pus.system_id = ANY($' + idx + '))');
      params.push(filterParams.system_ids); 
      idx++;
    }

    // Add organize_id condition
    if (filterParams.organize_id) {
      where.push('pu.organize_id = $' + idx);
      params.push(filterParams.organize_id);
      idx++;
    }

    // Add contact_ids condition
    if (filterParams.contact_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_contacts puc WHERE puc.user_id = pu.id AND puc.contact_id = ANY($' + idx + '))');
      params.push(filterParams.contact_ids);
      idx++;
    }

    // Combine WHERE conditions
    let whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Build and execute main query to get filtered accounts
    const sql = `
      SELECT DISTINCT pu.* 
      FROM priv_users pu
      ${whereClause}
      ORDER BY pu.id
    `;
    
    const result = await pool.query(sql, params);
    const rows = result.rows;

    // Load related data for each account in parallel
    await Promise.all(rows.map(async (acc) => {
      // Load all related data concurrently
      const [contactRows, systemRows, orgRows, roleRows, serverRows] = await Promise.all([
        // Get contacts
        pool.query(
          `SELECT c.name 
           FROM priv_user_contacts puc 
           JOIN contacts c ON puc.contact_id = c.id 
           WHERE puc.user_id = $1`,
          [acc.id]
        ),
        
        // Get systems
        pool.query(
          `SELECT s.name 
           FROM priv_user_systems pus 
           JOIN systems s ON pus.system_id = s.id 
           WHERE pus.user_id = $1`,
          [acc.id]
        ),
        
        // Get organize unit if exists
        acc.organize_id ? pool.query(
          'SELECT name FROM units WHERE id = $1',
          [acc.organize_id]
        ) : Promise.resolve({rows: []}),

        // Get role if exists
        acc.role_id ? pool.query(
          'SELECT name FROM priv_roles WHERE id = $1',
          [acc.role_id]
        ) : Promise.resolve({rows: []}),

        // Get servers if needed
        (acc.account_type === 'OS' || acc.account_type === 'DB') ? pool.query(
          `SELECT s.name 
           FROM priv_user_servers pus 
           JOIN servers s ON pus.server_id = s.id 
           WHERE pus.user_id = $1`,
          [acc.id]
        ) : Promise.resolve({rows: []})
      ]);

      // Assign results to account object
      acc.contacts = contactRows.rows.map(c => c.name).join(', ');
      acc.systems = systemRows.rows.map(s => s.name).join(', ');
      acc.organize = orgRows.rows[0]?.name || '';
      acc.role = roleRows.rows[0]?.name || ''; 
      acc.servers = serverRows.rows.map(s => s.name).join(', ');
    }));

    // Create workbook and worksheet
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Privileged Accounts');

    // Define columns with descriptive headers
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Account Name', key: 'username', width: 32 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Organize Unit', key: 'organize', width: 24 },
      { header: 'Account Type', key: 'account_type', width: 16 },
      { header: 'Management Method', key: 'manage_type', width: 20 },
      { header: 'Role', key: 'role', width: 24 },
      { header: 'System(s)', key: 'systems', width: 32 },
      { header: 'Server(s)', key: 'servers', width: 32 },
      { header: 'Application URL', key: 'app_url', width: 40 },
      { header: 'Contact(s)', key: 'contacts', width: 32 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Updated Date', key: 'updated_date', width: 20 },
      { header: 'Updated By', key: 'updated_by', width: 20 },
    ];

    // Write rows with data formatting
    rows.forEach(row => {
      sheet.addRow({
        id: row.id,
        username: row.username,
        description: row.description || '',
        organize: row.organize || '',
        account_type: row.account_type || '',
        manage_type: row.manage_type || '',
        role: row.role || '',
        systems: row.systems || '',
        servers: row.servers || '',
        app_url: row.app_url || '',
        contacts: row.contacts || '',
        created_at: row.created_at ? new Date(row.created_at).toLocaleString() : '',
        updated_date: row.updated_date ? new Date(row.updated_date).toLocaleString() : '', 
        updated_by: row.updated_by || ''
      }).commit();
    });

    // Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="privileged_accounts.xlsx"');

    // Finalize and send the workbook
    await sheet.commit();
    await workbook.commit();

  } catch (err) {
    console.error('Error exporting privileged accounts:', err);
    res.status(500).send('Failed to export: ' + err.message);
  }
};

export default privAccountController;
