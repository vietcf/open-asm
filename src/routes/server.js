const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const serverController = require('../controllers/serverController');
const checkPermission = require('../middlewares/checkPermission');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

const router = express.Router();

// ====== SERVER MENU ======
// List servers
router.get('/server/list', requireLogin, require2fa, checkPermission('read', 'server'), serverController.listServer);
// Export server list as Excel (filtered)
router.get('/server/export', requireLogin, require2fa, checkPermission('read', 'server'), serverController.exportServerList);
// Add server
router.get('/server/add', checkPermission('create', 'server'), serverController.addServerForm);
router.post('/server/add', checkPermission('create', 'server'), serverController.createServer);
// Edit server
router.get('/server/:id/edit', checkPermission('update', 'server'), serverController.editServerForm);
router.post('/server/:id/edit', checkPermission('update', 'server'), serverController.updateServer);
// Delete server
router.post('/server/:id/delete', checkPermission('delete', 'server'), serverController.deleteServer);

// ====== SERVICE MENU ======
// List services
router.get('/service/list', checkPermission('read', 'service'), serverController.listService);
// Add service
router.post('/service/add', checkPermission('create', 'service'), serverController.createService);
// Edit service
router.post('/service/:id/edit', checkPermission('update', 'service'), serverController.updateService);
// Delete service
router.post('/service/:id/delete', checkPermission('delete', 'service'), serverController.deleteService);

// ====== AGENT MENU ======
// List agents
router.get('/agent/list', checkPermission('read', 'agent'), serverController.listAgent);
// Add agent
router.post('/agent/add', checkPermission('create', 'agent'), serverController.createAgent);
// Edit agent
router.post('/agent/:id/edit', checkPermission('update', 'agent'), serverController.updateAgent);
// Delete agent
router.post('/agent/:id/delete', checkPermission('delete', 'agent'), serverController.deleteAgent);


// ====== AJAX MENU ======
// API: Get server detail by ID (for AJAX/modal)
router.get('/server/api/:id/detail', checkPermission('read', 'server'), serverController.detailServer);
// API: Get services for select2 ajax. Call from server edit or add form
router.get('/api/service', serverController.apiSearchService);
// API: Get agents for select2 ajax. 
// Call from server edit or add form
router.get('/api/agent',serverController.apiSearchAgent);
// API: Get servers for select2 ajax. 
// Call from system add/edit form
router.get('/api/server',serverController.apiSearchServer);

module.exports = router;
