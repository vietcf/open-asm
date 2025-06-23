// src/config/firewall.js
// Centralized configuration for firewall module

module.exports = {
  firewallNameOptions: [
    'USER',
    'SERVER',
    'INTERNET-IN',
    'INTERNET-OUT',
    'BACKBOND',
    'DMZ',
    'PARTNER',
    'DIGI'
  ],
  actionsOptions: ['ALLOW', 'DENY', 'DROP', 'REJECT'],
  statusOptions: ['ENABLE', 'DISABLE'],
  violationTypeOptions: [
    'CDE-TO-OUT-OF-SCOPE',
    'OUT-OF-SCOPE-TO-CDE', 
    'IN-CDE-NONE-SECURE-PORTS',
    'OUT-CDE-NONE-SECURE-PORTS',
    'ANY',
    'TEST/DEV/UAT-PRODUCTION',
    'USER-SERVER-MGMT-PORTS'
  ],
  // Add more firewall-specific config here as needed
};
