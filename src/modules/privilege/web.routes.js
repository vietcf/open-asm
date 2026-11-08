// Web routes of the Privileged Account module, mounted at /priv-account.
import express from 'express';
import accounts from './priv-user.controller.js';
import { rolePages, permissionPages, pickers } from './priv-role.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';

const router = express.Router();
const can = requirePermission;

function mountPages(path, pages, permission) {
  router.get(path, can(`${permission}.read`), pages.list);
  router.get(`${path}/export`, can(`${permission}.read`), pages.export);
  router.get(`${path}/add`, can(`${permission}.create`), pages.addForm);
  router.post(`${path}/add`, can(`${permission}.create`), pages.create);
  router.get(`${path}/:id/edit`, can(`${permission}.update`), pages.editForm);
  router.post(`${path}/:id/edit`, can(`${permission}.update`), pages.update);
  router.post(`${path}/:id/delete`, can(`${permission}.delete`), pages.remove);
}

mountPages('/account', accounts, 'priv_account');
mountPages('/role', rolePages, 'priv_role');
mountPages('/permission', permissionPages, 'priv_permission');

// AJAX pickers of the account / role forms
router.get('/api/systems', can('priv_account.create', 'priv_account.update', 'priv_role.create', 'priv_role.update', 'priv_permission.create', 'priv_permission.update'), pickers.systems);
router.get('/api/roles', can('priv_account.create', 'priv_account.update', 'priv_role.read'), pickers.roles);
router.get('/api/permissions', can('priv_role.create', 'priv_role.update', 'priv_permission.read'), pickers.permissions);

export default router;
