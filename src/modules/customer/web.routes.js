// Web routes of the Customer module, mounted at /customer.
import express from 'express';
import customers, { customerImport } from './customer.controller.js';
import requirePermission, { canPick } from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';

const router = express.Router();
const can = requirePermission;

router.get('/', can('customer.read'), customers.list);
router.get('/export', can('customer.read'), customers.export);
router.get('/template', can('customer.create'), customerImport.template);
router.post('/validate-import', can('customer.create'), excelUpload, customerImport.validate);
router.post('/import', can('customer.create'), excelUpload, customerImport.import);
router.get('/download/customer-validation/:filename', can('customer.read'), customerImport.download);
router.get('/add', can('customer.create'), customers.addForm);
router.post('/add', can('customer.create'), customers.create);
router.get('/file/:id/view', can('customer.read'), customers.viewFile);
router.get('/:id/detail', can('customer.read'), customers.detail);
router.get('/:id/edit', can('customer.update'), customers.editForm);
router.post('/:id/edit', can('customer.update'), customers.update);
router.post('/:id/delete', can('customer.delete'), customers.remove);

// Select2 lookups (customers picked on other pages)
router.get('/api/customer', canPick('customer.read'), customers.lookup);
router.get('/api/customer/ids', canPick('customer.read'), customers.lookupByIds);
router.get('/api/networks', canPick('customer.read'), customers.networks);

export default router;
