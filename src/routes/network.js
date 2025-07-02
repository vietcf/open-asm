const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const networkController = require('../controllers/networkController');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();



// ====== IPADDRESS MENU ======
// List all IP addresses
router.get('/ip-address', checkPermission('read', 'ip_address'), networkController.listIP); 
// Create a new IP address
router.post('/ip-address', checkPermission('create', 'ip_address'), networkController.createIP); 
// Update an IP address
router.put('/ip-address/:id', checkPermission('update', 'ip_address'), networkController.updateIP);
// Delete an IP address
router.delete('/ip-address/:id', checkPermission('delete', 'ip_address'), networkController.deleteIP); 
// Export IP Address List as Excel (filtered)
router.get('/ip-address/export', checkPermission('read', 'ip_address'), networkController.exportIpAddressList);

// ====== SUBNET MENU ======
// List all subnets
router.get('/subnet-address', checkPermission('read', 'subnet'), networkController.listSubnet); 
// Create a new subnet
router.post('/subnet-address', checkPermission('create', 'subnet'), networkController.createSubnet); 
// Update a subnet
router.put('/subnet-address/:id', checkPermission('update', 'subnet'), networkController.updateSubnet); 
// Delete a subnet
router.delete('/subnet-address/:id', checkPermission('delete', 'subnet'), networkController.deleteSubnet); 



// ====== DOMAIN MENU ======
// List all domains
router.get('/domain', checkPermission('read', 'domain'), networkController.listDomain);
// Create a new domain
router.post('/domain', checkPermission('create', 'domain'), networkController.createDomain);
// Edit domain 
router.put('/domain/:id', checkPermission('update', 'domain'), networkController.updateDomain);
// Delete domain
router.delete('/domain/:id', checkPermission('delete', 'domain'), networkController.deleteDomain);


// ====== AJAX API ======

// API: Get subnet detail by ID (subnet detail page)
// Use for subnet detail in subnet list
router.get('/api/subnet-address/:id', checkPermission('read', 'subnet'), networkController.detailSubnet);


// API: Search IP addresses for select2 ajax 
router.get('/api/ip-addresses',networkController.apiSearchIPAddresses);


// API: Domain search for select2 ajax 
router.get('/api/domain',networkController.apiDomainSearch);

// API: Search unassigned IP addresses for select2 ajax 
router.get('/api/ip-addresses/unassigned',networkController.apiSearchUnassignedIPAddresses);

// Protected route example
// router.get('/list', checkPermission('read', 'network'), networkController.listNetworks);

module.exports = router;
