import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import Configuration from '../models/Configuration.js';
import SystemLog from '../models/SystemLog.js';
import bcrypt from 'bcrypt';
import { pool } from '../../config/config.js';
import { clearPermissionsCache } from '../middlewares/permissions.middleware.js';

// ===== USER MANAGEMENT =====
const administratorController = {};

administratorController.listUsers = async (req, res) => {
  try {
    // Get query parameters
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    
    // Build search filters
    const filters = {};
    if (search) {
      filters.search = search;
    }
    
    const totalCount = await User.countFiltered(filters);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    
    // If requested page > totalPages, redirect to last page
    if (page > totalPages) {
      return res.redirect(`/administrator/users?page=${totalPages}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`);
    }
    
    const userList = await User.findFilteredList({ ...filters, page, pageSize });
    const roles = await Role.findAll();
    
    // Get page size options from configuration
    const pageSizeConfig = await Configuration.findById('page_size');
    const pageSizeOptions = pageSizeConfig ? 
      pageSizeConfig.value.split(',').map(size => parseInt(size.trim(), 10)) : 
      [10, 20, 50, 100];
    
    res.render('pages/administrator/user_list', {
      userList,
      roles,
      search,
      page,
      totalPages,
      pageSize,
      totalCount,
      pageSizeOptions,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'User Management',
      activeMenu: 'user-management'
    });
  } catch (err) {
    res.status(500).send('Error loading user list: ' + err.message);
  }
};

administratorController.createUser = async (req, res) => {
  try {
    const { username, email, fullname, role, password } = req.body;
    // Normalize and trim input fields
    const normUsername = username ? username.trim() : '';
    const normEmail = email ? email.trim() : '';
    const normFullname = fullname ? fullname.trim() : '';
    const normRole = role ? Number(role) : null;
    const normPassword = password ? password.trim() : '';
    // Validate required fields
    if (!normUsername || !normEmail || !normPassword) {
      req.flash('error', 'Username, email, and password are required!');
      return res.redirect('/administrator/users');
    }
    if (!normRole || isNaN(normRole)) {
      req.flash('error', 'Role is required!');
      return res.redirect('/administrator/users');
    }
    // Check if role_id exists in DB
    const validRole = await Role.findById(normRole);
    if (!validRole) {
      req.flash('error', 'Invalid role!');
      return res.redirect('/administrator/users');
    }
    if (normPassword.length < 4) {
      req.flash('error', 'Password must be at least 4 characters!');
      return res.redirect('/administrator/users');
    }
    // Get role_id directly from form
    const role_id = normRole;
    // Check duplicate username/email
    const existedUser = await User.findByUsername(normUsername);
    if (existedUser) {
      req.flash('error', 'Username already exists!');
      return res.redirect('/administrator/users');
    }
    // (Optional) Check duplicate email
    if (normEmail) {
      const existingEmailUser = await User.findByEmail(normEmail);
      if (existingEmailUser) {
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

administratorController.updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { username, email, fullname, role, password, repeat_password } = req.body;
    // Normalize and trim input fields
    const normUsername = username ? username.trim() : '';
    const normEmail = email ? email.trim() : '';
    const normFullname = fullname ? fullname.trim() : '';
    const normRole = role ? Number(role) : null;
    const normPassword = password ? password.trim() : '';
    const normRepeatPassword = repeat_password ? repeat_password.trim() : '';
    // Get current user info
    const currentUser = await User.findById(id);
    if (!currentUser) throw new Error('User not found');
    // If admin, do not allow changing username and role
    let newUsername = normUsername;
    let newRole = normRole;
    if (currentUser.username === 'admin') {
      newUsername = currentUser.username;
      newRole = currentUser.role_id;
    } else {
      if (!normRole || isNaN(normRole)) {
        throw new Error('Role is required');
      }
      const validRole = await Role.findById(normRole);
      if (!validRole) throw new Error('Invalid role');
      newRole = normRole;
    }
    
    // Check for duplicate username (excluding current user)
    if (newUsername !== currentUser.username) {
      const existingUsernameUser = await User.findByUsername(newUsername);
      if (existingUsernameUser && existingUsernameUser.id !== parseInt(id)) {
        req.flash('error', 'Username already exists!');
        return res.redirect('/administrator/users');
      }
    }
    
    // Check for duplicate email (excluding current user)
    if (normEmail && normEmail !== (currentUser.email || '').trim()) {
      const existingEmailUser = await User.findByEmail(normEmail);
      if (existingEmailUser && existingEmailUser.id !== parseInt(id)) {
        req.flash('error', 'Email already exists!');
        return res.redirect('/administrator/users');
      }
    }
    
    // Handle require_twofa from edit form
    const requireTwofaRaw = req.body.require_twofa;
    const require_twofa = requireTwofaRaw === 'on' ? true : false;
    // Handle must_change_password from edit form
    const mustChangePasswordRaw = req.body.must_change_password;
    const must_change_password = mustChangePasswordRaw === 'on' ? true : false;
    // Get OTP expiration days from configuration
    let otpDeadlineDays = 3;
    const otpDeadlineConfig = await Configuration.findByKey('otp_deadline_time');
    if (otpDeadlineConfig && otpDeadlineConfig.value && !isNaN(parseInt(otpDeadlineConfig.value))) {
      otpDeadlineDays = parseInt(otpDeadlineConfig.value);
    }
    if (require_twofa && (!currentUser.twofa_enabled || !currentUser.twofa_secret)) {
      const deadline = new Date(Date.now() + otpDeadlineDays * 24 * 60 * 60 * 1000);
      await User.updateTwofaDeadline(id, deadline.toISOString());
    } else if (!require_twofa) {
      await User.updateTwofaDeadline(id, null);
    }
    if (!require_twofa && currentUser.require_twofa) {
      await User.updateTwoFA(id, null, false);
    }
    let passwordHash = undefined;
    // Server-side validation: if password is entered, repeat_password must match
    if (normPassword) {
      if (!normRepeatPassword || normPassword !== normRepeatPassword) {
        req.flash('error', 'Passwords do not match!');
        return res.redirect('/administrator/users');
      }
      if (normPassword.length < 4) {
        req.flash('error', 'Password must be at least 4 characters!');
        return res.redirect('/administrator/users');
      }
      passwordHash = await bcrypt.hash(normPassword, 10);
    }
    // Handle is_active from edit form
    const isActiveRaw = req.body.is_active;
    const is_active = isActiveRaw === 'on' ? true : false;
    
    await User.update(id, { username: newUsername, email: normEmail, fullname: normFullname, role: newRole, require_twofa, must_change_password, passwordHash, is_active });
    req.flash('success', 'User updated successfully!');
    res.redirect('/administrator/users');
  } catch (err) {
    req.flash('error', 'Failed to update user: ' + err.message);
    res.redirect('/administrator/users');
  }
};

administratorController.deleteUser = async (req, res) => {
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

administratorController.listRoles = async (req, res) => {
  try {
    // Get query parameters
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    
    // Build search filters
    const filters = {};
    if (search) {
      filters.search = search;
    }
    
    const totalCount = await Role.countFiltered(filters);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    
    // If requested page > totalPages, redirect to last page
    if (page > totalPages) {
      return res.redirect(`/administrator/roles?page=${totalPages}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`);
    }
    
    const roles = await Role.findFilteredList({ ...filters, page, pageSize });
    const allPermissions = await getAllPermissions();
    const roleList = await Promise.all(
      roles.map(async (r) => ({
        ...r,
        permissions: await Role.getPermissions(r.id)
      }))
    );
    
    // Get page size options from configuration
    const pageSizeConfig = await Configuration.findById('page_size');
    const pageSizeOptions = pageSizeConfig ? 
      pageSizeConfig.value.split(',').map(size => parseInt(size.trim(), 10)) : 
      [10, 20, 50, 100];
    
    res.render('pages/administrator/role_list', {
      roleList,
      allPermissions,
      search,
      page,
      totalPages,
      pageSize,
      totalCount,
      pageSizeOptions,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'Role Management',
      activeMenu: 'role-management'
    });
  } catch (err) {
    res.status(500).send('Error loading role list: ' + err.message);
  }
};

administratorController.createRole = async (req, res) => {
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
    // @ts-ignore - client parameter is supported by model methods
    await Role.createWithPermissions({ name, description, permissions: permissions.map(Number) }, client);
    await client.query('COMMIT');
    
    // Clear permissions cache since new role with permissions was created
    clearPermissionsCache();
    
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

administratorController.updateRole = async (req, res) => {
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
    // @ts-ignore - client parameter is supported by model methods
    await Role.update(id, { name, description }, client);
    // @ts-ignore - client parameter is supported by model methods
    await Role.updatePermissions(id, permissions.map(Number), client);
    await client.query('COMMIT');
    
    // Clear permissions cache since role permissions were updated
    clearPermissionsCache();
    
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

administratorController.deleteRole = async (req, res) => {
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
administratorController.listPermissions = async (req, res) => {
  try {
    // Get query parameters
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    
    // Build search filters
    const filters = {};
    if (search) {
      filters.search = search;
    }
    
    const totalCount = await Permission.countFiltered(filters);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    
    // If requested page > totalPages, redirect to last page
    if (page > totalPages) {
      return res.redirect(`/administrator/permissions?page=${totalPages}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`);
    }
    
    const permissionList = await Permission.findFilteredList({ ...filters, page, pageSize });
    
    // Get page size options from configuration
    const pageSizeConfig = await Configuration.findById('page_size');
    const pageSizeOptions = pageSizeConfig ? 
      pageSizeConfig.value.split(',').map(size => parseInt(size.trim(), 10)) : 
      [10, 20, 50, 100];
    
    res.render('pages/administrator/permission_list', {
      permissionList,
      search,
      page,
      totalPages,
      pageSize,
      totalCount,
      pageSizeOptions,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'Permission Management',
      activeMenu: 'permission-management'
    });
  } catch (err) {
    res.status(500).send('Error loading permission list: ' + err.message);
  }
};

administratorController.createPermission = async (req, res) => {
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
    // Automatically assign this permission to superadmin
    const superadminRole = await Role.findAll();
    const superadmin = superadminRole.find(r => r.name === 'superadmin');
    if (superadmin && newPerm && newPerm.id) {
      // Get all permission ids of superadmin (including the new one)
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

administratorController.updatePermission = async (req, res) => {
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

administratorController.deletePermission = async (req, res) => {
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
administratorController.listConfigurations = async (req, res) => {
  try {
    // Get query parameters
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    
    // Get filtered configurations with pagination
    const filteredConfigs = await Configuration.findFilteredList({ search, page, pageSize });
    const totalCount = await Configuration.countFiltered({ search });
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Get page size options from configuration
    const pageSizeConfig = await Configuration.findById('page_size');
    const pageSizeOptions = pageSizeConfig ? 
      pageSizeConfig.value.split(',').map(size => parseInt(size.trim(), 10)) : 
      [10, 20, 50, 100];
    
    res.render('pages/administrator/configuration_list', {
      configList: filteredConfigs,
      search,
      page,
      pageSize,
      totalCount,
      totalPages,
      pageSizeOptions,
      success: (req.flash('success') || [])[0], 
      error: (req.flash('error') || [])[0],
      title: 'System Configuration',
      activeMenu: 'system-configuration'
    });
  } catch (err) {
    res.status(500).send('Error loading configuration: ' + err.message);
  }
};

administratorController.createConfiguration = async (req, res) => {
  try {
    let { key, value, description } = req.body;
    // Normalize and validate
    key = key ? key.trim() : '';
    value = value ? value.trim() : '';
    description = description ? description.trim() : '';
    const keyRegex = /^[a-zA-Z0-9_]+$/;
    // Validate key and value
    if (!key || !value) {
      req.flash('error', 'Key and Value are required!');
      return res.redirect('/administrator/configuration');
    }
    if (!keyRegex.test(key)) {
      req.flash('error', 'Key can only contain letters, numbers, and underscores (a-z, A-Z, 0-9, _)!');
      return res.redirect('/administrator/configuration');
    }

    // Custom validation for known keys
    if (key === 'page_size') {
      // Only allow comma-separated positive integers, unique, sorted ascending
      let sizes = value.split(',').map(v => v.trim());
      // All must be positive integers
      if (!sizes.length || sizes.some(v => !/^[1-9][0-9]*$/.test(v))) {
        req.flash('error', 'All values must be positive integers, separated by commas!');
        return res.redirect('/administrator/configuration');
      }
      // Check uniqueness
      const uniqueSizes = Array.from(new Set(sizes));
      if (uniqueSizes.length !== sizes.length) {
        req.flash('error', 'Page size values must be unique!');
        return res.redirect('/administrator/configuration');
      }
      // Check sorted ascending
      const sortedSizes = [...sizes].map(Number).sort((a, b) => a - b).map(String);
      if (JSON.stringify(sizes) !== JSON.stringify(sortedSizes)) {
        req.flash('error', 'Page size values must be sorted in ascending order!');
        return res.redirect('/administrator/configuration');
      }
    } 
    else if (key === 'log_level') {
      // Only allow info, warning, critical
      const allowed = ['info','warning','critical'];
      if (!allowed.includes(value)) {
        req.flash('error', 'Log level must be one of: info, warning, critical.');
        return res.redirect('/administrator/configuration');
      }
    }
    else if (key === 'log_retention_days') {
      // Must be a positive integer
      if (!/^[0-9]+$/.test(value) || parseInt(value) <= 0) {
        req.flash('error', 'Log retention days must be a positive integer!');
        return res.redirect('/administrator/configuration');
      }
    }

    const user = req.session.user ? req.session.user.username : null;
    await Configuration.create({ key, value, description, updatedBy: user });
    req.flash('success', 'Configuration added successfully!');
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to add configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

administratorController.updateConfiguration = async (req, res) => {
  try {
    // Support both PUT (RESTful) and traditional POST
    let key = req.params.key || req.body.key;
    let { value, description } = req.body;
    key = key ? key.trim() : '';
    value = value ? value.trim() : '';
    description = description ? description.trim() : '';
    const keyRegex = /^[a-zA-Z0-9_]+$/;

    // Validate key and value
    if (!key || !value) {
      req.flash('error', 'Key and Value are required.');
      return res.redirect('/administrator/configuration');
    }
    if (!keyRegex.test(key)) {
      req.flash('error', 'Key can only contain letters, numbers, and underscores (a-z, A-Z, 0-9, _)!');
      return res.redirect('/administrator/configuration');
    }

    // Custom validation for known keys
    if (key === 'page_size') {
      // Only allow comma-separated positive integers, unique, sorted ascending
      let sizes = value.split(',').map(v => v.trim());
      // All must be positive integers
      if (!sizes.length || sizes.some(v => !/^[1-9][0-9]*$/.test(v))) {
        req.flash('error', 'All values must be positive integers, separated by commas!');
        return res.redirect('/administrator/configuration');
      }
      // Check uniqueness
      const uniqueSizes = Array.from(new Set(sizes));
      if (uniqueSizes.length !== sizes.length) {
        req.flash('error', 'Page size values must be unique!');
        return res.redirect('/administrator/configuration');
      }
      // Check sorted ascending
      const sortedSizes = [...sizes].map(Number).sort((a, b) => a - b).map(String);
      if (JSON.stringify(sizes) !== JSON.stringify(sortedSizes)) {
        req.flash('error', 'Page size values must be sorted in ascending order!');
        return res.redirect('/administrator/configuration');
      }
    }
    else if (key === 'log_level') {
      // Only allow info, warning, critical
      const allowed = ['info','warning','critical'];
      if (!allowed.includes(value)) {
        req.flash('error', 'Log level must be one of: info, warning, critical.');
        return res.redirect('/administrator/configuration');
      }
    }
    else if (key === 'log_retention_days') {
      // Must be a positive integer
      if (!/^[0-9]+$/.test(value) || parseInt(value) <= 0) {
        req.flash('error', 'Log retention days must be a positive integer!');
        return res.redirect('/administrator/configuration');
      }
    }

    const user = req.session.user ? req.session.user.username : null;
    await Configuration.update(key, { value, description, updatedBy: user });
    // Reload site config cache after updating any configuration
    const { siteConfig } = await import('../utils/siteConfig.js');
    await siteConfig.initialize();
    req.flash('success', 'Configuration updated successfully!');
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to update configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

administratorController.deleteConfiguration = async (req, res) => {
  try {
    // Support both DELETE (RESTful) and traditional POST
    const key = req.params.key || req.body.key;
    if (!key) {
      req.flash('error', 'Key is required.');
      return res.redirect('/administrator/configuration');
    }
    await Configuration.remove(key);
    req.flash('success', 'Configuration deleted successfully!');
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to delete configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

// Export Configuration
administratorController.exportConfiguration = async (req, res) => {
  try {
    const configList = await Configuration.findAll();
    const dataStr = JSON.stringify(configList, null, 2);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=system-configuration.json');
    res.send(dataStr);
  } catch (err) {
    req.flash('error', 'Failed to export configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

// Import Configuration
administratorController.importConfiguration = async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'No file uploaded.');
      return res.redirect('/administrator/configuration');
    }
    
    const configData = JSON.parse(req.file.buffer.toString());
    let imported = 0;
    let updated = 0;
    
    for (const config of configData) {
      if (config.key && config.value) {
        const existing = await Configuration.findById(config.key);
        if (existing) {
          await Configuration.update(config.key, { 
            value: config.value, 
            description: config.description || existing.description,
            updatedBy: req.session.user?.username 
          });
          updated++;
        } else {
          await Configuration.create({ 
            key: config.key, 
            value: config.value, 
            description: config.description || '',
            updatedBy: req.session.user?.username 
          });
          imported++;
        }
      }
    }
    
    req.flash('success', `Configuration imported successfully! ${imported} new, ${updated} updated.`);
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to import configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

// Delete configuration
administratorController.deleteConfiguration = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      req.flash('error', 'Configuration key is required.');
      return res.redirect('/administrator/configuration');
    }

    // Check if configuration exists
    const existingConfig = await Configuration.findById(key);
    if (!existingConfig) {
      req.flash('error', 'Configuration not found.');
      return res.redirect('/administrator/configuration');
    }

    // Delete the configuration
    await Configuration.remove(key);
    
    req.flash('success', `Configuration '${key}' deleted successfully.`);
    res.redirect('/administrator/configuration');
  } catch (err) {
    req.flash('error', 'Failed to delete configuration: ' + err.message);
    res.redirect('/administrator/configuration');
  }
};

// ===== SYSTEM LOG =====
administratorController.listSystemLogs = async (req, res) => {
  try {
    // Get query parameters
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    
    // Build search conditions
    let whereClause = '';
    let queryParams = [];
    let paramCount = 0;
    
    if (search) {
      whereClause = `WHERE username ILIKE $${++paramCount} OR action ILIKE $${++paramCount} OR description ILIKE $${++paramCount} OR status ILIKE $${++paramCount}`;
      const searchPattern = `%${search}%`;
      queryParams = [searchPattern, searchPattern, searchPattern, searchPattern];
    }
    
    // Get total count with search
    const countQuery = `SELECT COUNT(*) FROM system_log ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    
    // Get logs for current page with search
    const offset = (page - 1) * pageSize;
    const logsQuery = `SELECT * FROM system_log ${whereClause} ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    const logsParams = [...queryParams, pageSize, offset];
    const logsResult = await pool.query(logsQuery, logsParams);
    const logs = logsResult.rows;
    
    // Get page size options from configuration
    const pageSizeConfig = await Configuration.findById('page_size');
    const pageSizeOptions = pageSizeConfig ? 
      pageSizeConfig.value.split(',').map(size => parseInt(size.trim(), 10)) : 
      [10, 20, 50, 100];
    
    res.render('pages/administrator/system_log', {
      logs,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      pageSizeOptions,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'System Log',
      activeMenu: 'system-log'
    });
  } catch (err) {
    res.status(500).send('Error loading system log: ' + err.message);
  }
};

export default administratorController;
