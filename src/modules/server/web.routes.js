// Web routes of the Server module (servers, services, agents), mounted at /server.
import express from 'express';
import servers, { serverImport } from './server.controller.js';
import Service from './service.model.js';
import Agent from './agent.model.js';
import services from './service.service.js';
import agents from './agent.service.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';
import { catalogPages, mountCatalogPages } from '../../shared/catalogWeb.js';

const router = express.Router();
const can = requirePermission;

const servicePages = catalogPages({
  service: services, model: Service, base: '/server/service', permission: 'service', activeMenu: 'service', icon: 'bi-gear',
  labels: { section: 'Server Management', list: 'Service List', singular: 'Service', add: 'Add Service', edit: 'Edit Service',
    search: 'Search Service...', empty: 'No services found', summary: 'Showing {1} - {2} of {3} services' },
  fields: [{ key: 'name', label: 'Service Name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }],
  usageLabel: 'Servers',
});
const agentPages = catalogPages({
  service: agents, model: Agent, base: '/server/agent', permission: 'agent', activeMenu: 'agent', icon: 'bi-cpu',
  labels: { section: 'Server Management', list: 'Agent List', singular: 'Agent', add: 'Add Agent', edit: 'Edit Agent',
    search: 'Search Agent...', empty: 'No agents found', summary: 'Showing {1} - {2} of {3} agents' },
  fields: [{ key: 'name', label: 'Agent Name', required: true }, { key: 'version', label: 'Version', maxlength: 50 },
    { key: 'description', label: 'Description', type: 'textarea' }],
  usageLabel: 'Servers',
});

// Servers
router.get('/server', can('server.read'), servers.list);
router.get('/server/export', can('server.read'), servers.export);
router.get('/server/template', can('server.create'), serverImport.template);
router.post('/server/validate-import', can('server.create'), excelUpload, serverImport.validate);
router.post('/server/import', can('server.create'), excelUpload, serverImport.import);
router.get('/download/server-validation/:filename', can('server.read'), serverImport.download);
router.get('/server/add', can('server.create'), servers.addForm);
router.post('/server/add', can('server.create'), servers.create);
router.get('/server/:id/duplicate', can('server.create'), servers.duplicateForm);
router.get('/server/:id/edit', can('server.update'), servers.editForm);
router.post('/server/:id/edit', can('server.update'), servers.update);
router.post('/server/:id/delete', can('server.delete'), servers.remove);
router.get('/server/api/:id/detail', can('server.read'), servers.detail);

// Catalogs
mountCatalogPages(router, '/service', servicePages, 'service', can);
mountCatalogPages(router, '/agent', agentPages, 'agent', can);

// Select2 lookups, open to any signed-in user
router.get('/api/server', servers.lookup);
router.get('/api/service', servicePages.lookup);
router.get('/api/service/ids', servicePages.lookupByIds);
router.get('/api/agent', agentPages.lookup);
router.get('/api/agent/ids', agentPages.lookupByIds);

export default router;
