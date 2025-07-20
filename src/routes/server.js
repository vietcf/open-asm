import express from 'express';
import serverController from '../controllers/serverController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';


const router = express.Router();

// ====== SERVER MENU ======
// List servers
router.get('/server/list', requirePermission('server.read'), serverController.listServer);
// Export server list as Excel (filtered)
router.get('/server/export', requirePermission('server.read'), serverController.exportServerList);
// Add server
router.get('/server/add', requirePermission('server.create'), serverController.addServerForm);
router.post('/server/add', requirePermission('server.create'), serverController.createServer);
// Edit server
router.get('/server/:id/edit', requirePermission('server.update'), serverController.editServerForm);
router.post('/server/:id/edit', requirePermission('server.update'), serverController.updateServer);
// Delete server
router.post('/server/:id/delete', requirePermission('server.delete'), serverController.deleteServer);

// ====== SERVICE MENU ======
// List services
router.get('/service/list', requirePermission('service.read'), serverController.listService);
// Add service
router.post('/service/add', requirePermission('service.create'), serverController.createService);
// Edit service
router.post('/service/:id/edit', requirePermission('service.update'), serverController.updateService);
// Delete service
router.post('/service/:id/delete', requirePermission('service.delete'), serverController.deleteService);

// ====== AGENT MENU ======
// List agents
router.get('/agent/list', requirePermission('agent.read'), serverController.listAgent);
// Add agent
router.post('/agent/add', requirePermission('agent.create'), serverController.createAgent);
// Edit agent
router.post('/agent/:id/edit', requirePermission('agent.update'), serverController.updateAgent);
// Delete agent
router.post('/agent/:id/delete', requirePermission('agent.delete'), serverController.deleteAgent);


// ====== AJAX MENU ======
// API: Get server detail by ID (for AJAX/modal)
router.get('/server/api/:id/detail', requirePermission('server.read'), serverController.detailServer);
// API: Get services for select2 ajax. Call from server edit or add form
router.get('/api/service', serverController.apiSearchService);
// API: Get agents for select2 ajax. 
// Call from server edit or add form
router.get('/api/agent',serverController.apiSearchAgent);
// API: Get servers for select2 ajax. 
// Call from system add/edit form
router.get('/api/server',serverController.apiSearchServer);

export default router;
