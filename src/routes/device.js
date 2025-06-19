// Device routes for Device List, Device Type, and Device Platform
// Each route renders the corresponding EJS view in /public/html/pages

const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const checkPermission = require('../middlewares/checkPermission');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');


// ====== DEVICE MENU ======
// Render the Device List page (now using controller)
router.get('/device', checkPermission('read', 'device'), deviceController.listDevice);
router.get('/device/add', checkPermission('create', 'device'), deviceController.addDeviceForm);
router.post('/device/add', checkPermission('create', 'device'), deviceController.createDevice);
router.get('/device/edit/:id', checkPermission('update', 'device'), deviceController.editDeviceForm);
router.post('/device/update/:id', checkPermission('update', 'device'), deviceController.updateDevice);
router.delete('/device/delete/:id', checkPermission('delete', 'device'), deviceController.deleteDevice);
router.get('/device/export', deviceController.exportDeviceList);


// ====== PLATFORM MENU ======
router.get('/platform', checkPermission('read', 'platform'), deviceController.listPlatform);
router.post('/platform', checkPermission('create', 'platform'), deviceController.createPlatform);
router.put('/platform/:id', checkPermission('update', 'platform'), deviceController.updatePlatform);
router.delete('/platform/:id', checkPermission('delete', 'platform'), deviceController.deletePlatform);


// ====== DEVICE TYPE MENU ======
router.get('/type', requireLogin, require2fa, checkPermission('read', 'device_type'), deviceController.listDeviceType);
router.post('/type', checkPermission('create', 'device_type'), deviceController.createDeviceType);
router.put('/type/:id', checkPermission('update', 'device_type'), deviceController.updateDeviceType);
router.delete('/type/:id', checkPermission('delete', 'device_type'), deviceController.deleteDeviceType);


// ========== API ROUTES ==========
// API: Platform search for select2 ajax (platform dropdown). Used in device and server add/edit forms
// Permissions to access this API:
// - platform.read: View platform list (e.g. for dropdown selection)
// - device.create, device.update: When creating/updating a device, platforms can be selected
// - server.create, server.update: When creating/updating a server, platforms can be selected
router.get(
  '/api/platform',
  (req, res, next) => {
    if (
      (req.session.permissions && req.session.permissions.includes('platform.read')) || // Use for platform selection
      (req.session.permissions && req.session.permissions.includes('device.create')) || // Use for device create
      (req.session.permissions && req.session.permissions.includes('device.update')) || // Use for device update
      (req.session.permissions && req.session.permissions.includes('server.create')) || // Use for server create
      (req.session.permissions && req.session.permissions.includes('server.update')) // Use for server update
    ) {
      return next();
    }
    return res.status(403).send('Forbidden');
  },
  deviceController.apiPlatformSearch
);

// API: Device type search for select2 ajax (device add/edit)
// Permissions to access this API:
// - device_type.read: View device type list (e.g. for dropdown selection)
// - device.create, device.update: When creating/updating a device, device types can be selected
router.get(
  '/api/device-type',
  (req, res, next) => {
    if (
      (req.session.permissions && req.session.permissions.includes('device_type.read')) ||
      (req.session.permissions && req.session.permissions.includes('device.create')) ||
      (req.session.permissions && req.session.permissions.includes('device.update'))
    ) {
      return next();
    }
    return res.status(403).send('Forbidden');
  },
  deviceController.apiDeviceTypeSearch
);


module.exports = router;
