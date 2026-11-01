// Web routes of the Administrator module, mounted at /administrator.
import express from 'express';
import users from './user.controller.js';
import { rolePages, permissionPages } from './role.controller.js';
import configuration from './configuration.controller.js';
import systemLog from './system-log.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';

const router = express.Router();
const can = requirePermission;

function mountPages(path, pages, permission) {
  router.get(path, can(`${permission}.read`), pages.list);
  router.get(`${path}/add`, can(`${permission}.create`), pages.addForm);
  router.post(`${path}/add`, can(`${permission}.create`), pages.create);
  router.get(`${path}/:id/edit`, can(`${permission}.update`), pages.editForm);
  router.post(`${path}/:id/edit`, can(`${permission}.update`), pages.update);
  router.post(`${path}/:id/delete`, can(`${permission}.delete`), pages.remove);
}

mountPages('/users', users, 'user');
mountPages('/roles', rolePages, 'role');
mountPages('/permissions', permissionPages, 'permission');

router.get('/configuration', can('configuration.read'), configuration.configurationHome);
router.get('/configuration/:group', can('configuration.read'), configuration.showConfigurationGroup);
router.put('/configuration/:group', can('configuration.update'), configuration.saveConfigurationGroup); // via _method=PUT

router.get('/log', can('system_log.read'), systemLog.listSystemLogs);
router.get('/log/export', can('system_log.read'), systemLog.exportSystemLogs);

export default router;
