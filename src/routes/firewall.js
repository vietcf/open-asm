
import express from 'express';
import firewallController from '../controllers/firewallController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

//----------------------------------
// ====== FIREWALL MENU ======
//----------------------------------

// ====== FIREWALL RULE MENU ======
// List firewall rules
router.get('/rule', requirePermission('rule.read'), firewallController.ruleList);
// Export firewall rule list as Excel (filtered)
router.get('/rule/export', requirePermission('rule.read'), firewallController.exportRuleList);
// Add firewall rule
router.post('/rule', requirePermission('rule.create'), firewallController.addRule);
// Edit firewall rule
router.post('/rule/:id', requirePermission('rule.update'), firewallController.editRule);
// Delete firewall rule
router.delete('/rule/:id', requirePermission('rule.delete'), firewallController.deleteRule);

// ====== FIREWALL BATCH MENU ======
// Batch update work order
router.post('/api/batch-update-wo', requirePermission('rule.update'), firewallController.batchUpdateWorkOrder);

export default router;
