
import express from 'express';
import administratorController from '../controllers/administratorController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';


const router = express.Router();



// User Management
router.get('/users', requirePermission('read', 'user'), administratorController.listUsers);
router.post('/users', requirePermission('create', 'user'), administratorController.createUser);
router.put('/users/:id/edit', requirePermission('update', 'user'), administratorController.updateUser); // dùng _method=PUT
router.delete('/users/:id', requirePermission('delete', 'user'), administratorController.deleteUser); // dùng method DELETE cho đúng RESTful

// Role Management
router.get('/roles', requirePermission('read', 'role'), administratorController.listRoles);
router.post('/roles', requirePermission('create', 'role'), administratorController.createRole);
router.put('/roles/:id/edit', requirePermission('update', 'role'), administratorController.updateRole); // Use PUT method for RESTful
router.delete('/roles/:id', requirePermission('delete', 'role'), administratorController.deleteRole); // Use DELETE method for RESTful

// Permission Management
router.get('/permissions', requirePermission('read', 'permission'), administratorController.listPermissions);
router.post('/permissions', requirePermission('create', 'permission'), administratorController.createPermission);
router.put('/permissions/:id/edit', requirePermission('update', 'permission'), administratorController.updatePermission); // Use PUT for edit
router.delete('/permissions/:id', requirePermission('delete', 'permission'), administratorController.deletePermission); // Use DELETE for delete

// System Configuration
router.get('/configuration', requirePermission('read', 'configuration'), administratorController.listConfigurations);
router.post('/configuration', requirePermission('create', 'configuration'), administratorController.createConfiguration);
router.post('/configuration/:key', requirePermission('update', 'configuration'), administratorController.updateConfiguration);
//router.delete('/configuration/:key', requirePermission('delete', 'configuration'), administratorController.deleteConfiguration); // Use DELETE for delete

// System Log
router.get('/log', requirePermission('read', 'system_log'), administratorController.listSystemLogs);

export default router;
