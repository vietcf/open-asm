const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Configuration = require('../models/Configuration');
const SystemLog = require('../models/SystemLog');
const bcrypt = require('bcrypt');
const { pool } = require('../../config/config');

// ===== USER MANAGEMENT =====
exports.listUsers = async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    
    // Use global pageSizeOptions from res.locals (set in app.js)
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    
    const totalCount = await User.countAll();
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) {
      return res.redirect(`/administrator/users?page=${totalPages}&pageSize=${pageSize}`);
    }
    const userList = await User.findPage(page, pageSize);
    const roles = await Role.findAll();
    
    res.render('pages/administrator/user_list', {
      userList, 
      roles, 
      page, 
      totalPages, 
      pageSize, 
      totalCount, 
      success: (req.flash('success') || [])[0], 
      error: (req.flash('error') || [])[0],
      title: 'User Management',
      activeMenu: 'user-management'
      // pageSizeOptions, defaultPageSize, siteName, cssPath, jsPath, imgPath, permissions đã có trong res.locals
    });
  } catch (err) {
    res.status(500).send('Error loading user list: ' + err.message);
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, fullname, role, password } = req.body;
    // Normalize and trim input fields
    const normUsername = username ? username.trim() : '';
    const normEmail = email ? email.trim() : '';
    const normFullname = fullname ? fullname.trim() : '';
    const normRole = role ? role.trim() : '';
    const normPassword = password ? password.trim() : '';
    // Validate required fields
    if (!normUsername || !normEmail || !normPassword) {
      req.flash('error', 'Username, email, and password are required!');
      return res.redirect('/administrator/users');
    }
    if (!normRole) {
      req.flash('error', 'Role is required!');
      return res.redirect('/administrator/users');
    }
    if (normPassword.length < 4) {
      req.flash('error', 'Password must be at least 4 characters!');
      return res.redirect('/administrator/users');
    }
    // Get role_id from role name
    const roles = await Role.findAll();
    const roleObj = roles.find(r => r.name === normRole);
    const role_id = roleObj ? roleObj.id : null;
    if (!role_id) {
      req.flash('error', 'Invalid role!');
      return res.redirect('/administrator/users');
    }
    // Check duplicate username/email
    const existedUser = await User.findByUsername(normUsername);
    if (existedUser) {
      req.flash('error', 'Username already exists!');
      return res.redirect('/administrator/users');
    }
    // (Optional) Check duplicate email
    if (normEmail) {
      const allUsers = await User.findAll();
      if (allUsers.some(u => (u.email || '').trim() === normEmail)) {
        req.flash('error', 'Email already exists!');
        return res.redirect('/administrator/users');
      }
    }
    // Read require_twofa from form (checkbox returns 'on' if checked)
    const requireTwofaRaw = req.body.require_twofa;
    const require_twofa = requireTwofaRaw === 'on' ? true : false;
    
    // Read must_change_password from form (checkbox returns 'on' if checked)
    const mustChangePasswordRaw = req.body.must_change_password;
    const must_change_password = mustChangePasswordRaw === 'on' ? true : false;
    
    const passwordHash = await bcrypt.hash(normPassword, 10);
    await User.create({ username: normUsername, email: normEmail, fullname: normFullname, role: role_id, passwordHash, require_twofa, must_change_password });
    req.flash('success', 'User added successfully!');
    res.redirect('/administrator/users');
  } catch (err) {
    req.flash('error', 'Failed to add user: ' + err.message);
    res.redirect('/administrator/users');
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { username, email, fullname, role, password } = req.body;
    // Normalize and trim input fields
    const normUsername = username ? username.trim() : '';
    const normEmail = email ? email.trim() : '';
    const normFullname = fullname ? fullname.trim() : '';
    const normRole = role ? role.trim() : '';
    const normPassword = password ? password.trim() : '';
    // Get current user info
    const currentUser = await User.findById(id);
    if (!currentUser) throw new Error('User not found');
    // If admin, do not allow changing username and role
    let newUsername = normUsername;
    let newRole = normRole;
    if (currentUser.username === 'admin') {
      newUsername = currentUser.username;
      newRole = currentUser.role_id; // Use role_id (number) instead of role (name)
    } else {
      // Get role_id from role name
      const roles = await Role.findAll();
      const roleObj = roles.find(r => r.name === normRole);
      newRole = roleObj ? roleObj.id : null;
      if (!newRole) throw new Error('Invalid role');
    }
    // Handle require_twofa from edit form
    const requireTwofaRaw = req.body.require_twofa;
    const require_twofa = requireTwofaRaw === 'on' ? true : false;
    
    // Handle must_change_password from edit form
    const mustChangePasswordRaw = req.body.must_change_password;
    const must_change_password = mustChangePasswordRaw === 'on' ? true : false;
    // Lấy số ngày hết hạn setup OTP từ configuration
    let otpDeadlineDays = 3;
    const otpDeadlineConfig = await Configuration.findByKey('otp_deadline_time');
    if (otpDeadlineConfig && otpDeadlineConfig.value && !isNaN(parseInt(otpDeadlineConfig.value))) {
      otpDeadlineDays = parseInt(otpDeadlineConfig.value);
    }
    // Nếu bật require_twofa và user chưa có 2FA, set deadline X ngày kể từ hiện tại
    if (require_twofa && (!currentUser.twofa_enabled || !currentUser.twofa_secret)) {
      const deadline = new Date(Date.now() + otpDeadlineDays * 24 * 60 * 60 * 1000);
      await User.updateTwofaDeadline(id, deadline);
    } else if (!require_twofa) {
      // Nếu tắt require_twofa thì clear deadline
      await User.updateTwofaDeadline(id, null);
    }
    // If turning off require_twofa, clear 2FA secret and disable 2FA
    if (!require_twofa && currentUser.require_twofa) {
      await User.updateTwoFA(id, null, false);
    }
    let passwordHash = undefined;
    if (normPassword && normPassword.length >= 4) {
      passwordHash = await bcrypt.hash(normPassword, 10);
    }
    await User.update(id, { username: newUsername, email: normEmail, fullname: normFullname, role: newRole, require_twofa, must_change_password, passwordHash });
    req.flash('success', 'User updated successfully!');
    res.redirect('/administrator/users');
  } catch (err) {
    req.flash('error', 'Failed to update user: ' + err.message);
    res.redirect('/administrator/users');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    // Prevent deleting admin user
    const user = await User.findById(id);
    if (user && user.username === 'admin') {
      req.flash('error', 'Cannot delete admin user!');
      return res.redirect('/administrator/users');
    }
    await User.delete(id);
    req.flash('success', 'User deleted successfully!');
    res.redirect('/administrator/users');
  } catch (err) {
    req.flash('error', 'Failed to delete user: ' + err.message);
    res.redirect('/administrator/users');
  }
};

// ===== ROLE MANAGEMENT =====
const getAllPermissions = async () => {
  const result = await pool.query('SELECT id, name, description FROM permissions ORDER BY name');
  return result.rows;
};

exports.listRoles = async (req, res) => {
  try {
    // Pagination and page size
    let page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    
    // Use global pageSizeOptions from res.locals (set in app.js)
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }

    // Get total count of roles
    const totalCountResult = await pool.query('SELECT COUNT(*) FROM roles');
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    // If requested page > totalPages, redirect to last page
    if (page > totalPages) {
      return res.redirect(`/administrator/roles?page=${totalPages}&pageSize=${pageSize}`);
    }
    const offset = (page - 1) * pageSize;
    // Get roles for current page
    const roles = (await pool.query('SELECT id, name, description FROM roles ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset])).rows;
    const allPermissions = await getAllPermissions();
    const roleList = await Promise.all(
      roles.map(async (r) => ({
        ...r,
        permissions: await Role.getPermissions(r.id)
      }))
    );
    
    res.render('pages/administrator/role_list', {
      roleList,
      allPermissions,
      page,
      totalPages,
      pageSize,
      totalCount,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'Role Management',
      activeMenu: 'role-management'
      // pageSizeOptions, cssPath, jsPath, imgPath, permissions đã có trong res.locals
    });
  } catch (err) {
    res.status(500).send('Error loading role list: ' + err.message);
  }
};

exports.createRole = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Normalize and trim input fields
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    let permissions = req.body.permissions;
    if (!permissions) permissions = [];
    if (!Array.isArray(permissions)) permissions = [permissions];
    // Backend validation: role name required
    if (!name) {
      req.flash('error', 'Role name is required!');
      await client.query('ROLLBACK');
      return res.redirect('/administrator/roles');
    }
    // Move DB logic to model
    await Role.createWithPermissions({ name, description, permissions: permissions.map(Number) }, client);
    await client.query('COMMIT');
    req.flash('success', 'Role added successfully!');
    res.redirect('/administrator/roles');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Failed to add role: ' + err.message);
    res.redirect('/administrator/roles');
  } finally {
    client.release();
  }
};

exports.updateRole = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    // Prevent editing superadmin role
    const roleObj = await Role.findById(id);
    if (roleObj && roleObj.name === 'superadmin') {
      req.flash('error', 'Cannot edit the superadmin role!');
      await client.query('ROLLBACK');
      return res.redirect('/administrator/roles');
    }
    // Normalize and trim input fields
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    let permissions = req.body.permissions;
    if (!permissions) permissions = [];
    if (!Array.isArray(permissions)) permissions = [permissions];
    // Backend validation: role name required
    if (!name) {
      req.flash('error', 'Role name is required!');
      await client.query('ROLLBACK');
      return res.redirect('/administrator/roles');
    }
    await Role.update(id, { name, description }, client);
    await Role.updatePermissions(id, permissions.map(Number), client);
    await client.query('COMMIT');
    req.flash('success', 'Role updated successfully!');
    res.redirect('/administrator/roles');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Failed to update role: ' + err.message);
    res.redirect('/administrator/roles');
  } finally {
    client.release();
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const id = req.params.id;
    // Prevent deleting superadmin role
    const roleObj = await Role.findById(id);
    if (roleObj && roleObj.name === 'superadmin') {
      req.flash('error', 'Cannot delete the superadmin role!');
      return res.redirect('/administrator/roles');
    }
    await Role.delete(id);
    req.flash('success', 'Role deleted successfully!');
    res.redirect('/administrator/roles');
  } catch (err) {
    req.flash('error', 'Failed to delete role: ' + err.message);
    res.redirect('/administrator/roles');
  }
};

// ===== PERMISSION MANAGEMENT =====
exports.listPermissions = async (req, res) => {
  try {
    // Pagination and page size
    let page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    
    // Use global pageSizeOptions from res.locals (set in app.js)
    if (!pageSize || !res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }

    // Use pool from config directly
    const totalCountResult = await pool.query('SELECT COUNT(*) FROM permissions');
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    // If requested page > totalPages, redirect to last page
    if (page > totalPages) {
      return res.redirect(`/administrator/permissions?page=${totalPages}&pageSize=${pageSize}`);
    }
    const offset = (page - 1) * pageSize;
    const permissionList = (await pool.query(
      'SELECT id, name, description FROM permissions ORDER BY name LIMIT $1 OFFSET $2',
      [pageSize, offset]
    )).rows;
    
    res.render('pages/administrator/permission_list', {
      permissionList,
      page,
      totalPages,
      pageSize,
      totalCount,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'Permission Management',
      activeMenu: 'permission-management'
      // pageSizeOptions, cssPath, jsPath, imgPath, permissions đã có trong res.locals
    });
  } catch (err) {
    res.status(500).send('Error loading permission list: ' + err.message);
  }
};

exports.createPermission = async (req, res) => {
  try {
    // Normalize and trim input fields
    const name = req.body.name ? req.body.name.trim() : '';
    const description = req.body.description ? req.body.description.trim() : '';
    const nameRegex = /^[a-zA-Z0-9_]+\.(read|create|update|delete)$/;
    if (!name) {
      req.flash('error', 'Permission name is required!');
      return res.redirect('/administrator/permissions');
    }
    if (!nameRegex.test(name)) {
      req.flash('error', 'Permission name must be in format abc.read|abc.create|abc.update|abc.delete');
      return res.redirect('/administrator/permissions');
    }
    const newPerm = await Permission.create({ name, description });
    // Tự động gán permission này cho superadmin
    const superadminRole = await Role.findAll();
    const superadmin = superadminRole.find(r => r.name === 'superadmin');
    if (superadmin && newPerm && newPerm.id) {
      // Lấy lại tất cả permission id của superadmin (bao gồm cái mới)
      const allPerms = await Permission.findAll();
      const allPermIds = allPerms.map(p => p.id);
      await Role.updatePermissions(superadmin.id, allPermIds);
    }
    req.flash('success', 'Permission added successfully!');
    res.redirect('/administrator/permissions');
  } catch (err) {
    req.flash('error', 'Failed to add permission: ' + err.message);
    res.redirect('/administrator/permissions');
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const id = req.params.id;
    const { description } = req.body;
    const name = req.body.name ? req.body.name.trim() : '';
    const nameRegex = /^[a-zA-Z0-9_]+\.(read|create|update|delete)$/;
    if (name && !nameRegex.test(name)) {
      req.flash('error', 'Permission name must be in format abc.read|abc.create|abc.update|abc.delete');
      return res.redirect('/administrator/permissions');
    }
    await Permission.update(id, { description });
    req.flash('success', 'Permission updated successfully!');
    res.redirect('/administrator/permissions');
  } catch (err) {
    req.flash('error', 'Failed to update permission: ' + err.message);
    res.redirect('/administrator/permissions');
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const id = req.params.id;
    await Permission.delete(id);
    req.flash('success', 'Permission deleted successfully!');
    res.redirect('/administrator/permissions');
  } catch (err) {
    req.flash('error', 'Failed to delete permission: ' + err.message);
    res.redirect('/administrator/permissions');
  }
};

// ===== SYSTEM CONFIGURATION CRUD =====
exports.listConfigurations = async (req, res) => {
  try {
    const configList = await Configuration.findAll();
    // Fetch site_name from Configuration// Sử dụng layout mặc định
    res.render('pages/administrator/configuration_list', {
      configList, 
      success: (req.flash('success') || [])[0], 
      error: (req.flash('error') || [])[0],
      title: 'System Configuration',
      activeMenu: 'system-configuration'
      // cssPath, jsPath, imgPath, permissions đã có sẵn trong res.locals từ app.js
    });
  } catch (err) {
    res.status(500).send('Error loading configuration: ' + err.message);
  }
};

exports.createConfiguration = async (req, res) => {
  try {
    let { key, value, description } = req.body;
    // Normalize and validate
    key = key ? key.trim() : '';
    value = value ? value.trim() : '';
    description = description ? description.trim() : '';
    if (!key || !value) {
      req.flash('error', 'Key and Value are required!');
      return res.redirect('/administrator/configuration');
    }
    // Custom validation for known keys
    if (key === 'page_size') {
      // Only allow comma-separated numbers from [5,10,15,20], unique, sorted ascending
      const allowed = ['5','10','15','20'];
      let sizes = value.split(',').map(v => v.trim());
      // All must be numbers, allowed, unique, sorted
      if (!sizes.length || sizes.some(v => !/^[0-9]+$/.test(v) || !allowed.includes(v))) {
        req.flash('error', 'All values must be numeric, order and separated by commas');
        return res.redirect('/administrator/configuration');
      }
      // Check uniqueness
      const uniqueSizes = Array.from(new Set(sizes));
      if (uniqueSizes.length !== sizes.length) {
        req.flash('error', 'Page size values must be unique.');
        return res.redirect('/administrator/configuration');
      }
      // Check sorted ascending
      const sortedSizes = [...sizes].map(Number).sort((a, b) => a - b).map(String);
      if (JSON.stringify(sizes) !== JSON.stringify(sortedSizes)) {
        req.flash('error', 'Page size values must be sorted in ascending order.');
        return res.redirect('/administrator/configuration');
      }
    } else if (key === 'log_level') {
      // Only allow info, warning, critical
      const allowed = ['info','warning','critical'];
      if (!allowed.includes(value)) {
        req.flash('error', 'Log level must be one of: info, warning, critical.');
        return res.redirect('/administrator/configuration');
      }
    } else if (key === 'log_retention_days') {
      // Must be a positive integer
      if (!/^[0-9]+$/.test(value) || parseInt(value) <= 0) {
        req.flash('error', 'Log retention days must be a positive number.');
        return res.redirect('/administrator/configuration');
      }
    }
    const user = req.session.user ? req.session.user.username : null;
    await Configuration.create(key, value, description, user);
    req.flash('success', 'Configuration added successfully!');
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to add configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

exports.updateConfiguration = async (req, res) => {
  try {
    // Hỗ trợ cả PUT (RESTful) và POST truyền thống
    const key = req.params.key || req.body.key;
    const { value, description } = req.body;
    if (!key || !value) {
      req.flash('error', 'Key and Value are required.');
      return res.redirect('/administrator/configuration');
    }
    await Configuration.updateByKey(key, value, req.session.user?.username || null, description);
    req.flash('success', 'Configuration updated successfully!');
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to update configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

exports.deleteConfiguration = async (req, res) => {
  try {
    // Hỗ trợ cả DELETE (RESTful) và POST truyền thống
    const key = req.params.key || req.body.key;
    if (!key) {
      req.flash('error', 'Key is required.');
      return res.redirect('/administrator/configuration');
    }
    await Configuration.deleteByKey(key);
    req.flash('success', 'Configuration deleted successfully!');
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to delete configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

// ===== SYSTEM LOG =====
exports.listSystemLogs = async (req, res) => {
  try {
    // Use global pageSizeOptions from res.locals (set in app.js)
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize;
    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM system_log');
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    
    // Get logs for current page (newest first)
    const logsResult = await pool.query('SELECT * FROM system_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [pageSize, offset]);
    const logs = logsResult.rows;
    
    res.render('pages/administrator/system_log', {
      logs,
      page,
      pageSize,
      totalPages,
      totalCount,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'System Log',
      activeMenu: 'system-log'
      // pageSizeOptions (as allowedPageSizes), cssPath, jsPath, imgPath, permissions đã có trong res.locals
    });
  } catch (err) {
    res.status(500).send('Error loading system log: ' + err.message);
  }
};
