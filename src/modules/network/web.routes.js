// Web routes of the Network module, mounted at /network.
import express from 'express';
import ips, { ipImport } from './ip-address.controller.js';
import subnets, { subnetImport } from './subnet.controller.js';
import domains, { domainImport } from './domain.controller.js';
import serviceMappings, { serviceMappingImport } from './service-mapping.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';

const router = express.Router();
const can = requirePermission;

// List / import / add / edit / delete pages of one entity
function mountPages(path, pages, imports, permission) {
  router.get(path, can(`${permission}.read`), pages.list);
  router.get(`${path}/export`, can(`${permission}.read`), pages.export);
  router.get(`${path}/template`, can(`${permission}.create`), imports.template);
  router.post(`${path}/validate-import`, can(`${permission}.create`), excelUpload, imports.validate);
  router.post(`${path}/import`, can(`${permission}.create`), excelUpload, imports.import);
  router.get(`${path}/add`, can(`${permission}.create`), pages.addForm);
  if (pages.duplicateForm) router.get(`${path}/:id/duplicate`, can(`${permission}.create`), pages.duplicateForm);
  router.post(`${path}/add`, can(`${permission}.create`), pages.create);
  router.get(`${path}/:id/edit`, can(`${permission}.update`), pages.editForm);
  router.post(`${path}/:id/edit`, can(`${permission}.update`), pages.update);
  router.post(`${path}/:id/delete`, can(`${permission}.delete`), pages.remove);
}

mountPages('/ip-address', ips, ipImport, 'ip_address');
mountPages('/subnet-address', subnets, subnetImport, 'subnet');
mountPages('/domain', domains, domainImport, 'domain');
router.get('/download/validation/:filename', can('ip_address.read'), ipImport.download);
router.get('/download/subnet-validation/:filename', can('subnet.read'), subnetImport.download);
router.get('/download/domain-validation/:filename', can('domain.read'), domainImport.download);

// Service Mapping (custom routes — has its own download path)
router.get('/service-mapping', can('service_mapping.read'), serviceMappings.list);
router.get('/service-mapping/export', can('service_mapping.read'), serviceMappings.export);
router.get('/service-mapping/template', can('service_mapping.create'), serviceMappingImport.template);
router.post('/service-mapping/validate-import', can('service_mapping.create'), excelUpload, serviceMappingImport.validate);
router.post('/service-mapping/import', can('service_mapping.create'), excelUpload, serviceMappingImport.import);
router.get('/download/service-mapping-validation/:filename', can('service_mapping.read'), serviceMappingImport.download);
router.get('/service-mapping/add', can('service_mapping.create'), serviceMappings.addForm);
router.post('/service-mapping/add', can('service_mapping.create'), serviceMappings.create);
router.get('/service-mapping/:id/duplicate', can('service_mapping.create'), serviceMappings.duplicateForm);
router.get('/service-mapping/:id/edit', can('service_mapping.update'), serviceMappings.editForm);
router.post('/service-mapping/:id/edit', can('service_mapping.update'), serviceMappings.update);
router.post('/service-mapping/:id/delete', can('service_mapping.delete'), serviceMappings.remove);

// AJAX pickers used by the forms of other modules, and the IP tooltip on every page
router.get('/api/ip-addresses', can('ip_address.read'), ips.search);
router.get('/api/ip-addresses/unassigned', can('ip_address.read'), ips.searchUnassigned);
router.get('/api/ip-addresses/search-all', can('ip_address.read'), ips.searchAll);
router.get('/api/ip-addresses/detail', can('ip_address.read'), ips.detail);
router.get('/api/ip-addresses/check', can('ip_address.read'), ips.check);
router.get('/api/domain', can('domain.read'), domains.search);
router.get('/api/service-mapping', serviceMappings.lookup);
router.get('/api/provider', serviceMappings.providers);

export default router;
