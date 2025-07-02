// Server configuration options for filter dropdowns, etc.

module.exports = {
  locations: [
    { value: 'DC', label: 'DC' },
    { value: 'DR', label: 'DR' },
    { value: 'CMC', label: 'CMC' },
    { value: 'BRANCH', label: 'BRANCH' },
    { value: 'CLOUD', label: 'CLOUD' },
  ],
  status: [
    { value: 'ONLINE', label: 'ONLINE' },
    { value: 'OFFLINE', label: 'OFFLINE' },
    { value: 'MAINTENANCE', label: 'MAINTENANCE' }
  ],
  types: [
    { value: 'PHYSICAL', label: 'PHYSICAL' },
    { value: 'VIRTUAL-MACHINE', label: 'VIRTUAL-MACHINE' },
    { value: 'CLOUD-INSTANCE', label: 'CLOUD-INSTANCE' }
  ]
};
