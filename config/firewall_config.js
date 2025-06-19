// src/config/firewall.js
// Centralized configuration for firewall module

module.exports = {
  actionsOptions: ['allow', 'deny', 'drop', 'reject'],
  statusOptions: ['enable', 'disable'],
  violationTypeOptions: [
    'cde to out of scope',
    'out of scope to cde', 
    'in cde none secure ports',
    'out cde none secure ports',
    'any',
    'test/dev-production',
    'user-to-production-mgmt-ports'
  ],
  // Add more firewall-specific config here as needed
};
