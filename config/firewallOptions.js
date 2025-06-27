// config/firewallOptions.js
// Centralized configuration for firewall module

module.exports = {
  firewallNameOptions: [
    { value: 'USER', label: 'USER' },
    { value: 'SERVER', label: 'SERVER' },
    { value: 'INTERNET-IN', label: 'INTERNET-IN' },
    { value: 'INTERNET-OUT', label: 'INTERNET-OUT' },
    { value: 'BACKBOND', label: 'BACKBOND' },
    { value: 'DMZ', label: 'DMZ' },
    { value: 'PARTNER', label: 'PARTNER' },
    { value: 'DIGI', label: 'DIGI' }
  ],
  actionsOptions: [
    { value: 'ALLOW', label: 'ALLOW' },
    { value: 'DENY', label: 'DENY' },
    { value: 'DROP', label: 'DROP' },
    { value: 'REJECT', label: 'REJECT' }
  ],
  statusOptions: [
    { value: 'ENABLE', label: 'ENABLE' },
    { value: 'DISABLE', label: 'DISABLE' }
  ],
  violationTypeOptions: [
    { value: 'CDE-TO-OUT-OF-SCOPE', label: 'CDE-TO-OUT-OF-SCOPE' },
    { value: 'OUT-OF-SCOPE-TO-CDE', label: 'OUT-OF-SCOPE-TO-CDE' },
    { value: 'IN-CDE-NONE-SECURE-PORTS', label: 'IN-CDE-NONE-SECURE-PORTS' },
    { value: 'OUT-CDE-NONE-SECURE-PORTS', label: 'OUT-CDE-NONE-SECURE-PORTS' },
    { value: 'ANY', label: 'ANY' },
    { value: 'TEST/DEV/UAT-PRODUCTION', label: 'TEST/DEV/UAT-PRODUCTION' },
    { value: 'USER-SERVER-MGMT-PORTS', label: 'USER-SERVER-MGMT-PORTS' }
  ]
  // Add more firewall-specific config here as needed
};
