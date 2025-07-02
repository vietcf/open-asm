const express = require('express');
const router = express.Router();
const administratorController = require('../controllers/administratorController');
const checkPermission = require('../middlewares/checkPermission');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

// User Management
router.get('/users', requireLogin, require2fa, checkPermission('read', 'user'), administratorController.listUsers);
router.post('/users', checkPermission('create', 'user'), administratorController.createUser);
router.put('/users/:id/edit', checkPermission('update', 'user'), administratorController.updateUser); // dùng _method=PUT
router.delete('/users/:id', checkPermission('delete', 'user'), administratorController.deleteUser); // dùng method DELETE cho đúng RESTful


// Role Management
router.get('/roles', checkPermission('read', 'role'), administratorController.listRoles);
router.post('/roles', checkPermission('create', 'role'), administratorController.createRole);
router.put('/roles/:id/edit', checkPermission('update', 'role'), administratorController.updateRole); // Use PUT method for RESTful
router.delete('/roles/:id', checkPermission('delete', 'role'), administratorController.deleteRole); // Use DELETE method for RESTful


// Permission Management
router.get('/permissions', checkPermission('read', 'permission'), administratorController.listPermissions);
router.post('/permissions', checkPermission('create', 'permission'), administratorController.createPermission);
router.put('/permissions/:id/edit', checkPermission('update', 'permission'), administratorController.updatePermission); // Use PUT for edit
router.delete('/permissions/:id', checkPermission('delete', 'permission'), administratorController.deletePermission); // Use DELETE for delete

// System Configuration
router.get('/configuration', checkPermission('read', 'configuration'), administratorController.listConfigurations);
router.post('/configuration', checkPermission('create', 'configuration'), administratorController.createConfiguration);
router.post('/configuration/:key', checkPermission('update', 'configuration'), administratorController.updateConfiguration);
//router.delete('/configuration/:key', checkPermission('delete', 'configuration'), administratorController.deleteConfiguration); // Use DELETE for delete
// System Log
router.get('/log', checkPermission('read', 'system_log'), administratorController.listSystemLogs);

module.exports = router;
