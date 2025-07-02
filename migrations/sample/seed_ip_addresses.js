module.exports = async (pool) => {
  await pool.query(`
    INSERT INTO ip_addresses (ip_address, description, server_id, updated_by) VALUES
      ('192.168.1.1', 'Main router', NULL, 'admin'),
      ('192.168.1.2', 'Backup router', NULL, 'admin'),
      ('10.0.0.10', 'Web server', 1, 'admin'),
      ('10.0.0.11', 'Database server', 1, 'admin'),
      ('10.0.0.12', 'App server', 2, 'admin'),
      ('10.0.0.13', 'Cache server', 2, 'admin'),
      ('10.0.0.14', 'Mail server', 3, 'admin'),
      ('10.0.0.15', 'Proxy server', 3, 'admin'),
      ('10.0.0.16', 'VPN gateway', NULL, 'admin'),
      ('10.0.0.17', 'Test server', NULL, 'admin'),
      ('10.0.0.18', 'Dev server', NULL, 'admin'),
      ('10.0.0.19', 'QA server', NULL, 'admin'),
      ('10.0.0.20', 'Staging server', NULL, 'admin'),
      ('10.0.0.21', 'Backup server', NULL, 'admin'),
      ('10.0.0.22', 'Monitoring server', NULL, 'admin'),
      ('10.0.0.23', 'Syslog server', NULL, 'admin'),
      ('10.0.0.24', 'NTP server', NULL, 'admin'),
      ('10.0.0.25', 'DNS server', NULL, 'admin'),
      ('10.0.0.26', 'DHCP server', NULL, 'admin'),
      ('10.0.0.27', 'File server', NULL, 'admin'),
      ('10.0.0.28', 'Print server', NULL, 'admin'),
      ('10.0.0.29', 'Media server', NULL, 'admin'),
      ('10.0.0.30', 'Build server', NULL, 'admin'),
      ('10.0.0.31', 'CI server', NULL, 'admin'),
      ('10.0.0.32', 'CD server', NULL, 'admin'),
      ('10.0.0.33', 'API gateway', NULL, 'admin'),
      ('10.0.0.34', 'Load balancer', NULL, 'admin'),
      ('10.0.0.35', 'Firewall', NULL, 'admin'),
      ('10.0.0.36', 'IoT device 1', NULL, 'admin'),
      ('10.0.0.37', 'IoT device 2', NULL, 'admin'),
      ('10.0.0.38', 'IoT device 3', NULL, 'admin'),
      ('10.0.0.39', 'IoT device 4', NULL, 'admin'),
      ('10.0.0.40', 'IoT device 5', NULL, 'admin'),
      ('10.0.0.41', 'Test device 1', NULL, 'admin'),
      ('10.0.0.42', 'Test device 2', NULL, 'admin'),
      ('10.0.0.43', 'Test device 3', NULL, 'admin'),
      ('10.0.0.44', 'Test device 4', NULL, 'admin'),
      ('10.0.0.45', 'Test device 5', NULL, 'admin'),
      ('10.0.0.46', 'Test device 6', NULL, 'admin'),
      ('10.0.0.47', 'Test device 7', NULL, 'admin'),
      ('10.0.0.48', 'Test device 8', NULL, 'admin'),
      ('10.0.0.49', 'Test device 9', NULL, 'admin'),
      ('10.0.0.50', 'Test device 10', NULL, 'admin'),
      ('192.168.1.10', NULL, 1, 'admin'),
      ('192.168.1.11', NULL, 1, 'admin'),
      ('10.0.0.5', NULL, 2, 'admin'),
      ('10.0.0.6', NULL, 2, 'admin'),
      ('172.16.0.100', NULL, 3, 'admin'),
      ('192.168.2.10', NULL, 4, 'admin'),
      ('192.168.2.11', NULL, 4, 'admin'),
      ('10.0.1.5', NULL, 5, 'admin'),
      ('10.0.1.6', NULL, 5, 'admin'),
      ('172.16.1.100', NULL, 6, 'admin'),
      ('192.168.3.10', NULL, 7, 'admin'),
      ('192.168.3.11', NULL, 7, 'admin'),
      ('10.0.2.5', NULL, 8, 'admin'),
      ('10.0.2.6', NULL, 8, 'admin'),
      ('172.16.2.100', NULL, 9, 'admin'),
      ('192.168.4.10', NULL, 10, 'admin'),
      ('192.168.4.11', NULL, 10, 'admin'),
      ('10.0.3.5', NULL, NULL, 'admin'),
      ('10.0.3.6', NULL, NULL, 'admin'),
      ('172.16.3.100', NULL, NULL, 'admin')
    ON CONFLICT (ip_address) DO NOTHING;
  `);

  // Seed tag_object: assign tags to some IPs (example: 2 tags per IP for first 10 IPs)
  await pool.query(`
    INSERT INTO tag_object (object_id, tag_id, object_type) VALUES
      (1, 1, 'ip_address'), (1, 2, 'ip_address'),
      (2, 2, 'ip_address'), (2, 3, 'ip_address'),
      (3, 1, 'ip_address'), (3, 3, 'ip_address'),
      (4, 1, 'ip_address'), (4, 4, 'ip_address'),
      (5, 2, 'ip_address'), (5, 4, 'ip_address'),
      (6, 3, 'ip_address'), (6, 4, 'ip_address'),
      (7, 1, 'ip_address'), (7, 2, 'ip_address'),
      (8, 2, 'ip_address'), (8, 3, 'ip_address'),
      (9, 1, 'ip_address'), (9, 3, 'ip_address')
    ON CONFLICT DO NOTHING;
  `);

  // Seed ip_contact: assign contacts to some IPs (example: 2 contacts per IP for first 10 IPs)
  await pool.query(`
    INSERT INTO ip_contact (ip_id, contact_id) VALUES
      (1, 1), (1, 2),
      (2, 2), (2, 3),
      (3, 1), (3, 3),
      (4, 2), (4, 4),
      (5, 1), (5, 4),
      (6, 2), (6, 5),
      (7, 3), (7, 5),
      (8, 1), (8, 5),
      (9, 2), (9, 3),
      (10, 4), (10, 5)
    ON CONFLICT DO NOTHING;
  `);
};