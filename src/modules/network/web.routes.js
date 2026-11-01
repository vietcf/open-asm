// Web routes of the Network module, mounted at /network.
import express from 'express';
import ips, { ipImport } from './ip-address.controller.js';
import subnets, { subnetImport } from './subnet.controller.js';
import domains, { domainImport } from './domain.controller.js';
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

// AJAX pickers used by the forms of other modules, and the IP tooltip on every page
router.get('/api/ip-addresses', can('ip_address.read'), ips.search);
router.get('/api/ip-addresses/unassigned', can('ip_address.read'), ips.searchUnassigned);
router.get('/api/ip-addresses/search-all', can('ip_address.read'), ips.searchAll);
router.get('/api/ip-addresses/detail', can('ip_address.read'), ips.detail);
router.get('/api/domain', can('domain.read'), domains.search);

export default router;
