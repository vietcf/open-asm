import express from 'express';
import deviceController from '../controllers/deviceController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';


const router = express.Router();

// Device Management
router.get('/device', requirePermission('device.read'), deviceController.listDevice);
router.post('/device', requirePermission('device.create'), deviceController.createDevice);
router.put('/device/:id', requirePermission('device.update'), deviceController.updateDevice);
router.delete('/device/:id', requirePermission('device.delete'), deviceController.deleteDevice);

// Device Form Routes (optional, for add/edit forms)
router.get('/device/add', requirePermission('device.create'), deviceController.addDeviceForm);
router.get('/device/edit/:id', requirePermission('device.update'), deviceController.editDeviceForm);
router.get('/device/export', deviceController.exportDeviceList);

// Platform Management
router.get('/platform', requirePermission('platform.read'), deviceController.listPlatform);
router.post('/platform', requirePermission('platform.create'), deviceController.createPlatform);
router.put('/platform/:id', requirePermission('platform.update'), deviceController.updatePlatform);
router.delete('/platform/:id', requirePermission('platform.delete'), deviceController.deletePlatform);

// Device Type Management
router.get('/type', requirePermission('device_type.read'), deviceController.listDeviceType);
router.post('/type', requirePermission('device_type.create'), deviceController.createDeviceType);
router.put('/type/:id', requirePermission('device_type.update'), deviceController.updateDeviceType);
router.delete('/type/:id', requirePermission('device_type.delete'), deviceController.deleteDeviceType);

// API Routes
router.get('/api/platform', deviceController.apiPlatformSearch);
router.get('/api/device-type', deviceController.apiDeviceTypeSearch);
router.get('/api/device', deviceController.apiDeviceSearch);
router.get('/api/manufacturers', deviceController.apiManufacturers);
router.get('/api/device-roles', deviceController.apiDeviceRoles);

export default router;
