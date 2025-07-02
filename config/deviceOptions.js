// config/deviceOptions.js
// Centralized configuration for device module (location, ...)

module.exports = {
  locationOptions: [
    { value: 'DC', label: 'Data Center DR' },
    { value: 'DR', label: 'Data Center DC' },
    { value: 'CMC', label: 'CMC Data Center' },
    { value: 'BRANCH', label: 'Branch Office' }
  ]
  // Add more device-specific config here as needed
};
