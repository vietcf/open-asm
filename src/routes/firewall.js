const express = require('express');
const router = express.Router();
const firewallController = require('../controllers/firewallController');
const checkPermission = require('../middlewares/checkPermission');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

//----------------------------------
// ====== FIREWALL MENU ======
//----------------------------------
// GET /firewall/rule
router.get('/rule', requireLogin, require2fa, checkPermission('read', 'rule'), firewallController.ruleList);
// POST /firewall/rule
router.post('/rule', checkPermission('create', 'rule'), firewallController.addRule);
// POST /firewall/rule/:id
router.post('/rule/:id', checkPermission('update', 'rule'), firewallController.editRule);
// DELETE /firewall/rule/:id
router.delete('/rule/:id', checkPermission('delete', 'rule'), firewallController.deleteRule);
// GET /firewall/rule/export
router.get('/rule/export', checkPermission('read', 'rule'), firewallController.exportRuleList);
// POST /firewall/rule/batch-update-wo
router.post('/api/batch-update-wo', checkPermission('update', 'rule'), firewallController.batchUpdateWorkOrder);

module.exports = router;
