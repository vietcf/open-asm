// migrations/seed_devices.js
// Seed sample devices data

module.exports = async (pool) => {
  await pool.query(`
    INSERT INTO devices (name, serial_number, device_type_id, platform_id, location, management_address, description, manufacturer, updated_by)
    VALUES
      ('Router Core', 'SN123456', 1, 1, 'Data Center 1', '10.0.0.1', 'Core router for main site', 'Cisco', 'admin'),
      ('Switch Edge', 'SN654321', 2, 1, 'Branch Office', '10.0.1.1', 'Edge switch for branch', 'Juniper', 'admin'),
      ('Firewall Main', 'SN987654', 3, 2, 'Data Center 2', '10.0.2.1', 'Main firewall', 'Fortinet', 'admin'),
      ('Access Point', 'SN111222', 4, 3, 'Office Floor 3', '10.0.3.1', 'WiFi AP', 'Ubiquiti', 'admin'),
      ('Server KVM', 'SN333444', 5, 2, 'Server Room', '10.0.4.1', 'KVM over IP device', 'Dell', 'admin')
    ON CONFLICT DO NOTHING;
  `);
};
