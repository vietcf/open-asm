
import express from 'express';
import firewallController from '../controllers/firewallController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

//----------------------------------
// ====== FIREWALL MENU ======
//----------------------------------

// ====== FIREWALL RULE MENU ======
// List firewall rules
router.get('/rule', requirePermission('read', 'rule'), firewallController.ruleList);
// Export firewall rule list as Excel (filtered)
router.get('/rule/export', requirePermission('read', 'rule'), firewallController.exportRuleList);
// Add firewall rule
router.post('/rule', requirePermission('create', 'rule'), firewallController.addRule);
// Edit firewall rule
router.post('/rule/:id', requirePermission('update', 'rule'), firewallController.editRule);
// Delete firewall rule
router.delete('/rule/:id', requirePermission('delete', 'rule'), firewallController.deleteRule);

// ====== FIREWALL BATCH MENU ======
// Batch update work order
router.post('/api/batch-update-wo', requirePermission('update', 'rule'), firewallController.batchUpdateWorkOrder);

export default router;
