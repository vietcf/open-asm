
import express from 'express';
import privAccountController from '../controllers/privAccountController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

// Privileged Account Management
router.get('/account', requirePermission('priv_account.read'), privAccountController.listAccounts);
router.post('/account', requirePermission('priv_account.create'), privAccountController.createAccount);
router.put('/account/:id', requirePermission('priv_account.update'), privAccountController.updateAccount);
router.delete('/account/:id', requirePermission('priv_account.delete'), privAccountController.deleteAccount);
router.get('/account/export', requirePermission('priv_account.read'), privAccountController.exportAccounts);

// Privileged Role Management
router.get('/role', requirePermission('priv_role.read'), privAccountController.listRoles);
router.post('/role', requirePermission('priv_role.create'), privAccountController.createRole);
router.put('/role/:id', requirePermission('priv_role.update'), privAccountController.updateRole);
router.delete('/role/:id', requirePermission('priv_role.delete'), privAccountController.deleteRole);
router.get('/role/export', requirePermission('priv_role.read'), privAccountController.exportRoles);

// Privileged Permission Management
router.get('/permission', requirePermission('priv_permission.read'), privAccountController.listPermissions);
router.post('/permission', requirePermission('priv_permission.create'), privAccountController.createPermission);
router.put('/permission/:id', requirePermission('priv_permission.update'), privAccountController.updatePermission);
router.delete('/permission/:id', requirePermission('priv_permission.delete'), privAccountController.deletePermission);
router.get('/permission/export', requirePermission('priv_permission.read'), privAccountController.exportPermissions);

// AJAX API: Get roles by system(s) for select2
router.post('/api/role/by-system', privAccountController.apiRoleBySystem);
// API: Get permissions by system_id (for Privileged Role add form AJAX)
router.get('/api/permissions', privAccountController.apiPermissionsBySystem);

export default router;
