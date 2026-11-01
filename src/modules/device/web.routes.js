// Web routes of the Device module (devices, device types, platforms), mounted at /device.
import express from 'express';
import devices, { deviceImport } from './device.controller.js';
import DeviceType from './device-type.model.js';
import Platform from './platform.model.js';
import deviceTypes from './device-type.service.js';
import platforms from './platform.service.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';
import { catalogPages, mountCatalogPages } from '../../shared/catalogWeb.js';

const router = express.Router();
const can = requirePermission;

const typePages = catalogPages({
  service: deviceTypes, model: DeviceType, base: '/device/type', permission: 'device_type', activeMenu: 'device-type', icon: 'bi-diagram-2',
  labels: { section: 'Device Management', list: 'Device Type List', singular: 'Device type', add: 'Add Device Type', edit: 'Edit Device Type',
    search: 'Search Device Type...', empty: 'No device types found', summary: 'Showing {1} - {2} of {3} device types' },
  fields: [{ key: 'name', label: 'Device Type Name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }],
  usageLabel: 'Devices',
});
const platformPages = catalogPages({
  service: platforms, model: Platform, base: '/device/platform', permission: 'platform', activeMenu: 'device-platform', icon: 'bi-windows',
  labels: { section: 'Device Management', list: 'Platform List', singular: 'Platform', add: 'Add Platform', edit: 'Edit Platform',
    search: 'Search Platform...', empty: 'No platforms found', summary: 'Showing {1} - {2} of {3} platforms' },
  fields: [{ key: 'name', label: 'Platform Name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }],
  usageLabel: 'Devices / Servers',
});

// Devices
router.get('/device', can('device.read'), devices.list);
router.get('/device/export', can('device.read'), devices.export);
router.get('/device/template', can('device.create'), deviceImport.template);
router.post('/device/validate-import', can('device.create'), excelUpload, deviceImport.validate);
router.post('/device/import', can('device.create'), excelUpload, deviceImport.import);
router.get('/download/device-validation/:filename', can('device.read'), deviceImport.download);
router.get('/device/add', can('device.create'), devices.addForm);
router.post('/device/add', can('device.create'), devices.create);
router.get('/device/:id/edit', can('device.update'), devices.editForm);
router.post('/device/:id/edit', can('device.update'), devices.update);
router.post('/device/:id/delete', can('device.delete'), devices.remove);

// Catalogs
mountCatalogPages(router, '/type', typePages, 'device_type', can);
mountCatalogPages(router, '/platform', platformPages, 'platform', can);

// Select2 lookups, open to any signed-in user
router.get('/api/device', devices.lookup);
router.get('/api/manufacturer', devices.manufacturers);
router.get('/api/device-role', devices.roles);
router.get('/api/device-type', typePages.lookup);
router.get('/api/device-type/ids', typePages.lookupByIds);
router.get('/api/platform', platformPages.lookup);
router.get('/api/platform/ids', platformPages.lookupByIds);

export default router;
