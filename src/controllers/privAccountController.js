const PrivUser = require('../models/PrivUser');
const PrivRole = require('../models/PrivRole');
const PrivPermission = require('../models/PrivPermission');
const config = require('../../config/config');
const { pool } = require('../../config/config');
const Configuration = require('../models/Configuration');
const System = require('../models/System');
const ExcelJS = require('exceljs');
const accountOptions = require('../../config/accountOptions');

//------------------------------------------------------
//PRIVIGED ACCOUNT CONTROLLER
//------------------------------------------------------

// Render Privileged Account List page with layout 
exports.listAccounts = async (req, res) => {
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

    let privUserList, totalCount;

    // Build WHERE clause dynamically
    let where = [];
    let params = [];
    let idx = 1;

    if (search) {
      where.push('(pu.username ILIKE $' + idx + ' OR pu.description ILIKE $' + idx + ')');
      params.push(`%${search}%`);
      idx++;
    }

    // Filter by systems (using priv_user_systems join table)
    if (system_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_systems pus WHERE pus.user_id = pu.id AND pus.system_id = ANY($' + idx + '))');
      params.push(system_ids);
      idx++;
    }

    // Filter by organize unit
    if (organize_id) {
      where.push('pu.organize_id = $' + idx);
      params.push(organize_id);
      idx++;
    }

    // Filter by contacts (using priv_user_contacts join table)
    if (contact_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_contacts puc WHERE puc.user_id = pu.id AND puc.contact_id = ANY($' + idx + '))');
      params.push(contact_ids);
      idx++;
    }

    let whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    // Get total count
    const countSql = `
      SELECT COUNT(DISTINCT pu.id) 
      FROM priv_users pu
      ${whereClause}
    `;
    const countResult = await pool.query(countSql, params);
    totalCount = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    params.push(pageSize, (page - 1) * pageSize);
    const sql = `
      SELECT DISTINCT pu.* 
      FROM priv_users pu
      ${whereClause}
      ORDER BY pu.id
      LIMIT $${params.length - 1} 
      OFFSET $${params.length}
    `;
    const result = await pool.query(sql, params);
    privUserList = result.rows;

    // Load details for each user
    for (const user of privUserList) {
      // Load contacts
      const contactRows = await pool.query(
        `SELECT c.id, c.name, c.email 
         FROM priv_user_contacts puc 
         JOIN contacts c ON puc.contact_id = c.id 
         WHERE puc.user_id = $1`,
        [user.id]
      );
      user.contacts = contactRows.rows;

      // Load systems
      const systemRows = await pool.query(
        `SELECT s.id, s.name 
         FROM priv_user_systems pus 
         JOIN systems s ON pus.system_id = s.id 
         WHERE pus.user_id = $1`,
        [user.id]
      );
      user.systems = systemRows.rows;

      // Load organize unit
      if (user.organize_id) {
        const orgRows = await pool.query('SELECT id, name FROM units WHERE id = $1', [user.organize_id]);
        user.organize = orgRows.rows[0];
      }

      // Load role
      if (user.role_id) {
        const roleRows = await pool.query('SELECT id, name FROM priv_roles WHERE id = $1', [user.role_id]);
        user.role = roleRows.rows[0];
      }

      // Load servers if needed
      if (user.account_type === 'OS' || user.account_type === 'DB') {
        const serverRows = await pool.query(
          `SELECT s.id, s.name 
           FROM priv_user_servers pus 
           JOIN servers s ON pus.server_id = s.id 
           WHERE pus.user_id = $1`,
          [user.id]
        );
        user.servers = serverRows.rows;
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);

    // Load selected filters for re-populating the filter form
    let selectedSystems = [];
    if (system_ids.length) {
      const systemRows = await pool.query('SELECT id, name FROM systems WHERE id = ANY($1)', [system_ids]);
      selectedSystems = systemRows.rows;
    }

    let selectedOrganize = null;
    if (organize_id) {
      const orgRows = await pool.query('SELECT id, name FROM units WHERE id = $1', [organize_id]);
      selectedOrganize = orgRows.rows[0];
    }

    let selectedContacts = [];
    if (contact_ids.length) {
      const contactRows = await pool.query('SELECT id, name FROM contacts WHERE id = ANY($1)', [contact_ids]);
      selectedContacts = contactRows.rows;
    }

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
      // Truyền đủ các biến cho filter modal
      system_ids,
      system_names: selectedSystems.map(s => s.name),
      organize_id: selectedOrganize ? selectedOrganize.id : '',
      organize_name: selectedOrganize ? selectedOrganize.name : '',
      contact_ids,
      contact_names: selectedContacts.map(c => c.name),
      // Thêm accountTypes và manageTypes cho EJS
      accountTypes: accountOptions.accountTypes,
      manageTypes: accountOptions.manageTypes,
      startItem,
      endItem,
      totalCount,
      allowedPageSizes: res.locals.pageSizeOptions,
      title: 'Privileged Account',
      activeMenu: 'priv-account'
    });
  } catch (err) {
    console.error('Error loading privileged accounts:', err);
    res.status(500).send('Error loading privileged accounts: ' + err.message);
  }
};

// Handle creating a new privileged account (with all associations)
exports.createAccount = async (req, res) => {
  // Lấy và chuẩn hóa dữ liệu từ form
  // Extract các trường form
  let {
    username,
    description,
    organize_id,
    role_id,
    account_type,
    manage_type,
    app_url
  } = req.body;
  // Khởi tạo giá trị mặc định nếu thiếu
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
  if (!Array.isArray(server_ids)) server_ids = server_ids ? [serverIds] : [];

  // Validate các trường bắt buộc
  const errors = [];
  if (!username.trim()) errors.push('Account Name is required.');
  if (!organize_id) errors.push('Organize Unit is required.');
  if (!role_id) errors.push('Role is required.');
  // Validate account_type and manage_type against config
  const allowedAccountTypes = accountOptions.accountTypes.map(opt => opt.value);
  const allowedManageTypes = accountOptions.manageTypes.map(opt => opt.value);
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

  // Nếu có lỗi, trả về giao diện với dữ liệu đã nhập và thông báo lỗi
  if (errors.length) {
    req.flash && req.flash('error', errors.join(' '));
    // Lưu lại dữ liệu đã nhập để repopulate form
    req.session.formData = {
      username, description, organize_id, role_id, account_type, manage_type, app_url,
      contacts, system_ids, server_ids
    };
    return res.redirect('/priv-account/account');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Insert main account
    const insertRes = await client.query(
      `INSERT INTO priv_users (username, description, organize_id, role_id, account_type, manage_type, app_url, created_at, updated_date, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8) RETURNING *`,
      [username, description, organize_id || null, role_id || null, account_type, manage_type, app_url || null, req.session.user?.username || username]
    );
    const account = insertRes.rows[0];
    // Insert contacts
    for (const contactId of contacts) {
      if (contactId) {
        await client.query('INSERT INTO priv_user_contacts (user_id, contact_id) VALUES ($1, $2)', [account.id, contactId]);
      }
    }
    // Insert systems
    for (const systemId of system_ids) {
      if (systemId) {
        await client.query('INSERT INTO priv_user_systems (user_id, system_id) VALUES ($1, $2)', [account.id, systemId]);
      }
    }
    // Insert servers
    for (const serverId of server_ids) {
      if (serverId) {
        await client.query('INSERT INTO priv_user_servers (user_id, server_id) VALUES ($1, $2)', [account.id, serverId]);
      }
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
exports.updateAccount = async (req, res) => {
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
  if (!Array.isArray(system_ids)) system_ids = system_ids ? [systemIds] : [];
  if (!Array.isArray(server_ids)) server_ids = server_ids ? [serverIds] : [];

  // Validate required fields
  const errors = [];
  if (!username.trim()) errors.push('Account Name is required.');
  if (!organize_id) errors.push('Organize Unit is required.');
  if (!role_id) errors.push('Role is required.');
  // Validate account_type and manage_type against config
  const allowedAccountTypes = accountOptions.accountTypes.map(opt => opt.value);
  const allowedManageTypes = accountOptions.manageTypes.map(opt => opt.value);
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
    // Update main account
    await client.query(
      `UPDATE priv_users SET username=$1, description=$2, organize_id=$3, role_id=$4, account_type=$5, manage_type=$6, app_url=$7, updated_date=NOW(), updated_by=$8 WHERE id=$9`,
      [username, description, organize_id || null, role_id || null, account_type, manage_type, app_url || null, req.session.user?.username || username, id]
    );
    // Remove old associations
    await client.query('DELETE FROM priv_user_contacts WHERE user_id = $1', [id]);
    await client.query('DELETE FROM priv_user_systems WHERE user_id = $1', [id]);
    await client.query('DELETE FROM priv_user_servers WHERE user_id = $1', [id]);
    // Insert new associations
    for (const contactId of contacts) {
      if (contactId) {
        await client.query('INSERT INTO priv_user_contacts (user_id, contact_id) VALUES ($1, $2)', [id, contactId]);
      }
    }
    for (const systemId of system_ids) {
      if (systemId) {
        await client.query('INSERT INTO priv_user_systems (user_id, system_id) VALUES ($1, $2)', [id, systemId]);
      }
    }
    for (const serverId of server_ids) {
      if (serverId) {
        await client.query('INSERT INTO priv_user_servers (user_id, server_id) VALUES ($1, $2)', [id, serverId]);
      }
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
exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    await PrivUser.delete(id);
    req.flash && req.flash('success', 'Privileged user deleted successfully!');
    res.redirect('/priv-account/account');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Delete failed.');
    res.redirect('/priv-account/account');
  }
};

// API: Get account details for edit modal (AJAX)
exports.getAccountDetails = async (req, res) => {
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
exports.listRoles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let pageSize = parseInt(req.query.pageSize) || res.locals.defaultPageSize;
    
    // Use global pageSizeOptions from res.locals (set in app.js)
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    
    const search = req.query.search ? req.query.search.trim() : '';
    const system_id = req.query.system_id ? req.query.system_id.trim() : '';
    let privRoleList, totalCount, totalPages;
    // Filtering logic
    if (search || system_id) {
      // Custom search with system filter
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
      // Count
      const countRes = await pool.query(`SELECT COUNT(*) FROM priv_roles r ${whereClause}`, params);
      totalCount = parseInt(countRes.rows[0].count, 10);
      // Page
      params.push(pageSize, (page - 1) * pageSize);
      const pageRes = await pool.query(
        `SELECT r.*, s.id as system_id, s.name as system_name FROM priv_roles r LEFT JOIN systems s ON r.system_id = s.id ${whereClause} ORDER BY r.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      privRoleList = pageRes.rows.map(row => ({
        ...row,
        system: row.system_id ? { id: row.system_id, name: row.system_name } : null
      }));
    } else {
      totalCount = await PrivRole.searchCount('');
      privRoleList = await PrivRole.searchPage('', page, pageSize);
    }
    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    // Calculate summary range for 'Showing x - y of z' display
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);
    // Load all permissions
    const allPermissions = await PrivPermission.findAll();
    // Attach permissions to each role
    for (const role of privRoleList) {
      role.permissions = await PrivRole.getPermissions(role.id);
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
exports.createRole = async (req, res) => {
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
    await PrivRole.updatePermissions(newRole.id, permissions.map(Number));
    req.flash && req.flash('success', 'Privileged role added successfully!');
    res.redirect('/priv-account/role');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Add failed.');
    res.redirect('/priv-account/role');
  }
};

// Handle updating a privileged role
exports.updateRole = async (req, res) => {
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
    await PrivRole.updatePermissions(id, permissions.map(Number));
    req.flash && req.flash('success', 'Privileged role updated successfully!');
    res.redirect('/priv-account/role');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Update failed.');
    res.redirect('/priv-account/role');
  }
};

// Handle deleting a privileged role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    await PrivRole.delete(id);
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
exports.listPermissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let pageSize = parseInt(req.query.pageSize) || res.locals.defaultPageSize;
    
    // Use global pageSizeOptions from res.locals (set in app.js)
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    
    const search = req.query.search ? req.query.search.trim() : '';
    const system_id = req.query.system_id ? req.query.system_id.trim() : '';
    let privPermissionList, totalCount, totalPages;
    // Filtering logic
    if (search || system_id) {
      // Custom search with system filter
      let where = [];
      let params = [];
      let idx = 1;
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
      // Count
      const countRes = await pool.query(`SELECT COUNT(*) FROM priv_permissions ${whereClause}`, params);
      totalCount = parseInt(countRes.rows[0].count, 10);
      // Page
      params.push(pageSize, (page - 1) * pageSize);
      const pageRes = await pool.query(
        `SELECT * FROM priv_permissions ${whereClause} ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      privPermissionList = pageRes.rows;
    } else {
      totalCount = await PrivPermission.searchCount('');
      privPermissionList = await PrivPermission.searchPage('', page, pageSize);
    }
    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    // Calculate summary range for 'Showing x - y of z' display
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);
    const success = req.flash ? req.flash('success')[0] : (req.query.success || null);
    const error = req.flash ? req.flash('error')[0] : (req.query.error || null);// Ensure each permission has its system info (join or fetch system name)
    for (const perm of privPermissionList) {
      perm.system = await System.findById(perm.system_id);
    }
    // Persist filter values for modal
    let system_name = '';
    if (system_id && privPermissionList.length > 0 && privPermissionList[0].system && privPermissionList[0].system.name) {
      system_name = privPermissionList[0].system.name;
    }
    
    res.render('pages/privilege/priv_permission_list', {
      privPermissionList, 
      page, 
      totalPages, 
      pageSize, 
      search, 
      system_id, 
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
exports.createPermission = async (req, res) => {
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
exports.updatePermission = async (req, res) => {
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
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    await PrivPermission.delete(id);
    req.flash && req.flash('success', 'Privileged permission deleted successfully!');
    res.redirect('/priv-account/permission');
  } catch (err) {
    req.flash && req.flash('error', err.message || 'Delete failed.');
    res.redirect('/priv-account/permission');
  }
};

// Export privileged permissions to Excel (with filter/search support)
exports.exportPermissions = async (req, res) => {
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
exports.exportRoles = async (req, res) => {
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
exports.apiRoleSearch = async (req, res) => {
  try {
    const search = req.query.search || '';
    let system_ids = req.query.system_ids || [];
    if (typeof system_ids === 'string' && system_ids) system_ids = [system_ids];
    if (!Array.isArray(system_ids)) system_ids = [];
    const roles = await PrivRole.apiSystemSearch(search, system_ids);
    res.json(roles.map(r => ({ id: r.id, text: r.name })));
  } catch (err) {
    res.status(500).json([]);
  }
};

// AJAX API: Get roles by system(s) only (no search, for select2)
exports.apiRoleBySystem = async (req, res) => {
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
exports.apiPermissionsBySystem = async (req, res) => {
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
exports.exportAccounts = async (req, res) => {
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
