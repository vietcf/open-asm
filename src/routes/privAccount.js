import express from 'express';
import privAccountController from '../controllers/privAccountController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';


const router = express.Router();

// Privileged Account List
router.get('/account', requirePermission('read', 'priv_account'), privAccountController.listAccounts);
router.post('/account', requirePermission('create', 'priv_account'), privAccountController.createAccount);
router.put('/account/:id/edit', requirePermission('update', 'priv_account'), privAccountController.updateAccount); // API: Update account (edit form submit, supports method override)
router.delete('/account/:id', requirePermission('delete', 'priv_account'), privAccountController.deleteAccount); // API: Delete account (supports method override)

// Export Privileged Accounts to Excel
router.get('/account/export', requirePermission('read', 'priv_account'), privAccountController.exportAccounts);

// Privileged Role List
router.get('/role', requirePermission('read', 'priv_role'), privAccountController.listRoles);
router.post('/role', requirePermission('create', 'priv_role'), privAccountController.createRole);
router.post('/role/:id/edit', requirePermission('update', 'priv_role'), privAccountController.updateRole);
router.post('/role/:id/delete', requirePermission('delete', 'priv_role'), privAccountController.deleteRole);

// Export Privileged Roles to Excel
router.get('/role/export', requirePermission('read', 'priv_role'), privAccountController.exportRoles);

// Privileged Permission List
router.get('/permission', requirePermission('read', 'priv_permission'), privAccountController.listPermissions);
router.post('/permission', requirePermission('create', 'priv_permission'), privAccountController.createPermission);
router.post('/permission/:id/edit', requirePermission('update', 'priv_permission'), privAccountController.updatePermission);
router.post('/permission/:id/delete', requirePermission('delete', 'priv_permission'), privAccountController.deletePermission);

// Export Privileged Permissions to Excel
router.get('/permission/export', requirePermission('read', 'priv_permission'), privAccountController.exportPermissions);

// AJAX API: Get roles by system(s) for select2
router.post('/api/role/by-system', privAccountController.apiRoleBySystem);

// API: Get permissions by system_id (for Privileged Role add form AJAX)
router.get('/api/permissions', privAccountController.apiPermissionsBySystem);

export default router;
