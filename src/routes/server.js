import express from 'express';
import serverController from '../controllers/serverController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';


const router = express.Router();

// ====== SERVER MENU ======
// List servers
router.get('/server/list', requirePermission('read', 'server'), serverController.listServer);
// Export server list as Excel (filtered)
router.get('/server/export', requirePermission('read', 'server'), serverController.exportServerList);
// Add server
router.get('/server/add', requirePermission('create', 'server'), serverController.addServerForm);
router.post('/server/add', requirePermission('create', 'server'), serverController.createServer);
// Edit server
router.get('/server/:id/edit', requirePermission('update', 'server'), serverController.editServerForm);
router.post('/server/:id/edit', requirePermission('update', 'server'), serverController.updateServer);
// Delete server
router.post('/server/:id/delete', requirePermission('delete', 'server'), serverController.deleteServer);

// ====== SERVICE MENU ======
// List services
router.get('/service/list', requirePermission('read', 'service'), serverController.listService);
// Add service
router.post('/service/add', requirePermission('create', 'service'), serverController.createService);
// Edit service
router.post('/service/:id/edit', requirePermission('update', 'service'), serverController.updateService);
// Delete service
router.post('/service/:id/delete', requirePermission('delete', 'service'), serverController.deleteService);

// ====== AGENT MENU ======
// List agents
router.get('/agent/list', requirePermission('read', 'agent'), serverController.listAgent);
// Add agent
router.post('/agent/add', requirePermission('create', 'agent'), serverController.createAgent);
// Edit agent
router.post('/agent/:id/edit', requirePermission('update', 'agent'), serverController.updateAgent);
// Delete agent
router.post('/agent/:id/delete', requirePermission('delete', 'agent'), serverController.deleteAgent);


// ====== AJAX MENU ======
// API: Get server detail by ID (for AJAX/modal)
router.get('/server/api/:id/detail', requirePermission('read', 'server'), serverController.detailServer);
// API: Get services for select2 ajax. Call from server edit or add form
router.get('/api/service', serverController.apiSearchService);
// API: Get agents for select2 ajax. 
// Call from server edit or add form
router.get('/api/agent',serverController.apiSearchAgent);
// API: Get servers for select2 ajax. 
// Call from system add/edit form
router.get('/api/server',serverController.apiSearchServer);

export default router;
