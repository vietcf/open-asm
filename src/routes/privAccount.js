// Author: long

const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const privAccountController = require('../controllers/privAccountController');
const checkPermission = require('../middlewares/checkPermission');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

const router = express.Router();

// Privileged Account List
router.get('/account', requireLogin, require2fa, checkPermission('read', 'priv_account'), privAccountController.listAccounts);
router.post('/account', checkPermission('create', 'priv_account'), privAccountController.createAccount);
router.put('/account/:id/edit', checkPermission('update', 'priv_account'), privAccountController.updateAccount); // API: Update account (edit form submit, supports method override)
router.delete('/account/:id', checkPermission('delete', 'priv_account'), privAccountController.deleteAccount); // API: Delete account (supports method override)

// Export Privileged Accounts to Excel
router.get('/account/export', checkPermission('read', 'priv_account'), privAccountController.exportAccounts);

// Privileged Role List
router.get('/role', checkPermission('read', 'priv_role'), privAccountController.listRoles);
router.post('/role', checkPermission('create', 'priv_role'), privAccountController.createRole);
router.post('/role/:id/edit', checkPermission('update', 'priv_role'), privAccountController.updateRole);
router.post('/role/:id/delete', checkPermission('delete', 'priv_role'), privAccountController.deleteRole);

// Export Privileged Roles to Excel
router.get('/role/export', checkPermission('read', 'priv_role'), privAccountController.exportRoles);

// Privileged Permission List
router.get('/permission', checkPermission('read', 'priv_permission'), privAccountController.listPermissions);
router.post('/permission', checkPermission('create', 'priv_permission'), privAccountController.createPermission);
router.post('/permission/:id/edit', checkPermission('update', 'priv_permission'), privAccountController.updatePermission);
router.post('/permission/:id/delete', checkPermission('delete', 'priv_permission'), privAccountController.deletePermission);

// Export Privileged Permissions to Excel
router.get('/permission/export', checkPermission('read', 'priv_permission'), privAccountController.exportPermissions);

// AJAX API: Get roles by system(s) for select2
router.post('/api/role/by-system', privAccountController.apiRoleBySystem);

// API: Get account details for edit modal (AJAX)
// Used by /public/html/pages/privilege/priv_account_list.ejs when opening edit modal
// Example request: /priv-account/account/5/edit
// router.get('/account/:id/edit', checkPermission('read', 'priv_account'), privAccountController.getAccountDetails); // API: Get account details for edit modal (AJAX)

// API: Get permissions by system_id (for Privileged Role add form AJAX)
router.get('/api/permissions', privAccountController.apiPermissionsBySystem);


module.exports = router;
