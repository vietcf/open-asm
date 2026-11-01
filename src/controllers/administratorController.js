import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import Configuration from '../models/Configuration.js';
import SystemLog, { LOG_LEVELS } from '../models/SystemLog.js';
import ExcelJS from 'exceljs';
import { sanitizeExcelObject } from '../utils/excelSafe.js';
import bcrypt from 'bcrypt';
import { pool } from '../../config/config.js';
import { clearPermissionsCache } from '../middlewares/permissions.middleware.js';
import { CONFIG_GROUPS, findGroup, parseOptions, validateField } from '../utils/configRegistry.js';
import { withTransaction } from '../shared/transaction.js';
import { siteConfig } from '../utils/siteConfig.js';

// ===== USER MANAGEMENT =====
const administratorController = {};

// No spaces or special characters — avoids usernames that are impossible to type
// consistently (leading/trailing spaces, unicode lookalikes, etc.) and cause
// confusing "Invalid username or password" login failures.
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;

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
    const auth_source = req.body.auth_source === 'ldap' ? 'ldap' : 'local';
    // Normalize and trim input fields
    const normUsername = username ? username.trim() : '';
    const normEmail = email ? email.trim() : '';
    const normFullname = fullname ? fullname.trim() : '';
    const normRole = role ? Number(role) : null;
    const normPassword = password ? password.trim() : '';
    // Validate required fields (password only applies to local accounts —
    // LDAP accounts authenticate against AD, no local password is stored)
    if (!normUsername || !normEmail || (auth_source === 'local' && !normPassword)) {
      req.flash('error', 'Username, email, and password are required!');
      return res.redirect('/administrator/users');
    }
    if (!USERNAME_REGEX.test(normUsername)) {
      req.flash('error', 'Username must be 3-50 characters and contain only letters, numbers, dots, hyphens, and underscores (no spaces).');
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
    if (auth_source === 'local' && normPassword.length < 4) {
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

    // Read must_change_password from form (checkbox returns 'on' if checked).
    // Never applies to LDAP accounts — AD owns the password, not this app.
    const mustChangePasswordRaw = req.body.must_change_password;
    const must_change_password = auth_source === 'ldap' ? false : (mustChangePasswordRaw === 'on' ? true : false);

    const passwordHash = auth_source === 'ldap' ? null : await bcrypt.hash(normPassword, 10);
    await User.create({ username: normUsername, email: normEmail, fullname: normFullname, role: role_id, passwordHash, require_twofa, must_change_password, auth_source });
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
    const auth_source = req.body.auth_source === 'ldap' ? 'ldap' : 'local';
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
      if (!USERNAME_REGEX.test(newUsername)) {
        throw new Error('Username must be 3-50 characters and contain only letters, numbers, dots, hyphens, and underscores (no spaces).');
      }
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
    // Handle must_change_password from edit form. Never applies to LDAP
    // accounts — AD owns the password, not this app.
    const mustChangePasswordRaw = req.body.must_change_password;
    const must_change_password = auth_source === 'ldap' ? false : (mustChangePasswordRaw === 'on' ? true : false);
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
    if (auth_source === 'local') {
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
      } else if (currentUser.auth_source === 'ldap') {
        // Switching a user from LDAP back to local requires a real password —
        // there's no existing local hash to fall back to.
        req.flash('error', 'Please set a password when switching this user to local authentication.');
        return res.redirect('/administrator/users');
      }
    }
    // Handle is_active from edit form
    const isActiveRaw = req.body.is_active;
    const is_active = isActiveRaw === 'on' ? true : false;

    await User.update(id, { username: newUsername, email: normEmail, fullname: normFullname, role: newRole, require_twofa, must_change_password, passwordHash, is_active, auth_source });
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
    // Handle specific database constraint errors with user-friendly messages
    let errorMessage = 'Failed to delete user';
    
    if (err.code === '23503') { // foreign_key_violation
      errorMessage = 'Cannot delete this user because they have associated records. Please remove all related data first.';
    } else if (err.message && err.message.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete this user because they are referenced by other records. Please clean up all references first.';
    } else {
      errorMessage = 'Failed to delete user: ' + err.message;
    }
    
    req.flash('error', errorMessage);
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
    // Handle specific database constraint errors with user-friendly messages
    let errorMessage = 'Failed to delete role';
    
    if (err.code === '23503') { // foreign_key_violation
      if (err.constraint === 'users_role_id_fkey') {
        errorMessage = 'Cannot delete this role because it is currently assigned to one or more users. Please reassign or remove those users first.';
      } else {
        errorMessage = 'Cannot delete this role because it is being used by other records. Please remove all references first.';
      }
    } else if (err.message && err.message.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete this role because it is currently in use. Please remove all users assigned to this role first.';
    } else {
      errorMessage = 'Failed to delete role: ' + err.message;
    }
    
    req.flash('error', errorMessage);
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

// ===== SYSTEM CONFIGURATION: GROUPED PAGES =====
// One tab per group of src/utils/configRegistry.js, each key with its own
// editor (option lists as a grid). This is the only way the app writes
// configuration, so every value goes through validateField().
administratorController.configurationHome = (req, res) => {
  res.redirect(`/administrator/configuration/${CONFIG_GROUPS[0].id}`);
};

administratorController.showConfigurationGroup = async (req, res, next) => {
  try {
    const group = findGroup(req.params.group);
    if (!group) return next();
    const rows = await Configuration.findByKeys(group.fields.map(f => f.key));
    const byKey = new Map(rows.map(r => [r.key, r]));
    const fields = group.fields.map(f => {
      const row = byKey.get(f.key);
      const stored = row ? row.value : null;
      return {
        ...f,
        exists: Boolean(row),
        value: f.type === 'options' ? parseOptions(stored) : (stored ?? ''),
        updated_by: row ? row.updated_by : null,
        updated_at: row ? row.updated_at : null,
      };
    });
    res.render('pages/administrator/configuration_group', {
      group,
      fields,
      groups: CONFIG_GROUPS,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'System Configuration',
      activeMenu: 'system-configuration'
    });
  } catch (err) {
    next(err);
  }
};

administratorController.saveConfigurationGroup = async (req, res, next) => {
  const group = findGroup(req.params.group);
  if (!group) return next();
  const back = `/administrator/configuration/${group.id}`;
  const submitted = req.body.fields || {};
  const t = req.t || (s => s);
  try {
    const stored = new Map((await Configuration.findByKeys(group.fields.map(f => f.key))).map(r => [r.key, r.value]));
    const changes = [];
    for (const field of group.fields) {
      if (!(field.key in submitted)) continue;
      const storedValues = field.type === 'options'
        ? new Set(parseOptions(stored.get(field.key)).map(o => o.value))
        : undefined;
      const result = validateField(field, submitted[field.key], storedValues);
      if (result.error) {
        req.flash('error', t(result.error, { field: t(field.label), ...result.params }));
        return res.redirect(back);
      }
      changes.push({ field, value: result.value });
    }
    const user = req.session.user ? req.session.user.username : null;
    await withTransaction(null, async client => {
      for (const { field, value } of changes) {
        if (value === null) await Configuration.remove(field.key, client);
        else await Configuration.upsert(field.key, { value, description: field.help || field.label, updatedBy: user }, client);
      }
    });
    await siteConfig.initialize();
    req.flash('success', t('{group} settings saved', { group: t(group.label) }));
    res.redirect(back);
  } catch (err) {
    req.flash('error', t('Failed to save configuration: {message}', { message: err.message }));
    res.redirect(back);
  }
};

// ===== SYSTEM LOG =====
// Two tabs on one page: application log ('app') and security audit
// ('security'); same filters for both, see SystemLog.findFiltered().
const LOG_EXPORT_LIMIT = 50000;

function logFilterFromQuery(query) {
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '');
  return {
    category: str(query.category) === 'security' ? 'security' : 'app',
    search: str(query.search),
    dateFrom: date(query.dateFrom),
    dateTo: date(query.dateTo),
    username: str(query.username),
    action: str(query.action),
    objectType: str(query.object_type),
    status: str(query.status),
    level: str(query.level),
    ip: str(query.ip),
  };
}

administratorController.listSystemLogs = async (req, res, next) => {
  try {
    const filter = logFilterFromQuery(req.query);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    const [logs, totalCount, usernames, actions, objectTypes, statuses] = await Promise.all([
      SystemLog.findFiltered(filter, { page, pageSize }),
      SystemLog.countFiltered(filter),
      SystemLog.distinctValues('username', filter.category),
      SystemLog.distinctValues('action', filter.category),
      SystemLog.distinctValues('object_type', filter.category),
      SystemLog.distinctValues('status', filter.category),
    ]);
    res.render('pages/administrator/system_log', {
      logs,
      filter,
      options: { usernames, actions, objectTypes, statuses, levels: LOG_LEVELS },
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      title: 'System Log',
      activeMenu: 'system-log'
    });
  } catch (err) {
    next(err);
  }
};

// Excel export of the current tab and filters (most recent first).
administratorController.exportSystemLogs = async (req, res, next) => {
  try {
    const filter = logFilterFromQuery(req.query);
    const t = req.t || (s => s);
    const logs = await SystemLog.findFiltered(filter, { page: 1, pageSize: LOG_EXPORT_LIMIT });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(filter.category === 'security' ? 'Security audit' : 'Application log');
    sheet.columns = [
      { header: t('Time'), key: 'created_at', width: 20 },
      { header: t('User'), key: 'username', width: 18 },
      { header: t('Action'), key: 'action', width: 16 },
      { header: t('Object'), key: 'object_type', width: 18 },
      { header: 'ID', key: 'object_id', width: 10 },
      { header: t('Result'), key: 'status', width: 10 },
      { header: t('Severity'), key: 'level', width: 10 },
      { header: t('IP Address'), key: 'ip_address', width: 16 },
      { header: t('Description'), key: 'description', width: 60 },
      { header: 'User agent', key: 'user_agent', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const log of logs) {
      sheet.addRow(sanitizeExcelObject({
        ...log,
        created_at: log.created_at ? new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19) : '',
      }));
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filter.category === 'security' ? 'security-audit' : 'app-log'}-${stamp}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

export default administratorController;
