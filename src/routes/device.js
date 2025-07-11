import express from 'express';
import deviceController from '../controllers/deviceController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';
// import requireLogin from '../middlewares/requireLogin.js';
// import require2fa from '../middlewares/require2fa.js';

const router = express.Router();

// ====== DEVICE MENU ======
router.get('/device', requirePermission('read', 'device'), deviceController.listDevice);
router.get('/device/add', requirePermission('create', 'device'), deviceController.addDeviceForm);
router.post('/device/add', requirePermission('create', 'device'), deviceController.createDevice);
router.get('/device/edit/:id', requirePermission('update', 'device'), deviceController.editDeviceForm);
router.post('/device/update/:id', requirePermission('update', 'device'), deviceController.updateDevice);
router.delete('/device/delete/:id', requirePermission('delete', 'device'), deviceController.deleteDevice);
router.get('/device/export', deviceController.exportDeviceList);

// ====== PLATFORM MENU ======
router.get('/platform', requirePermission('read', 'platform'), deviceController.listPlatform);
router.post('/platform', requirePermission('create', 'platform'), deviceController.createPlatform);
router.put('/platform/:id', requirePermission('update', 'platform'), deviceController.updatePlatform);
router.delete('/platform/:id', requirePermission('delete', 'platform'), deviceController.deletePlatform);

// ====== DEVICE TYPE MENU ======
router.get('/type' , requirePermission('read', 'device_type'), deviceController.listDeviceType);
router.post('/type', requirePermission('create', 'device_type'), deviceController.createDeviceType);
router.put('/type/:id', requirePermission('update', 'device_type'), deviceController.updateDeviceType);
router.delete('/type/:id', requirePermission('delete', 'device_type'), deviceController.deleteDeviceType);

// ========== API ROUTES ==========
router.get('/api/platform', deviceController.apiPlatformSearch);
router.get('/api/device-type', deviceController.apiDeviceTypeSearch);
router.get('/api/device', deviceController.apiDeviceSearch);

export default router;
