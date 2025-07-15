
import express from 'express';
import administratorController from '../controllers/administratorController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';


const router = express.Router();



// User Management
router.get('/users', requirePermission('user.read'), administratorController.listUsers);
router.post('/users', requirePermission('user.create'), administratorController.createUser);
router.put('/users/:id/edit', requirePermission('user.update'), administratorController.updateUser); // dùng _method=PUT
router.delete('/users/:id', requirePermission('user.delete'), administratorController.deleteUser); // dùng method DELETE cho đúng RESTful

// Role Management
router.get('/roles', requirePermission('role.read'), administratorController.listRoles);
router.post('/roles', requirePermission('role.create'), administratorController.createRole);
router.put('/roles/:id/edit', requirePermission('role.update'), administratorController.updateRole); // Use PUT method for RESTful
router.delete('/roles/:id', requirePermission('role.delete'), administratorController.deleteRole); // Use DELETE method for RESTful

// Permission Management
router.get('/permissions', requirePermission('permission.read'), administratorController.listPermissions);
router.post('/permissions', requirePermission('permission.create'), administratorController.createPermission);
router.put('/permissions/:id/edit', requirePermission('permission.update'), administratorController.updatePermission); // Use PUT for edit
router.delete('/permissions/:id', requirePermission('permission.delete'), administratorController.deletePermission); // Use DELETE for delete

// System Configuration
router.get('/configuration', requirePermission('configuration.read'), administratorController.listConfigurations);
router.post('/configuration', requirePermission('configuration.create'), administratorController.createConfiguration);
router.post('/configuration/:key', requirePermission('configuration.update'), administratorController.updateConfiguration);
//router.delete('/configuration/:key', requirePermission('configuration.delete'), administratorController.deleteConfiguration); // Use DELETE for delete

// System Log
router.get('/log', requirePermission('system_log.read'), administratorController.listSystemLogs);

export default router;
