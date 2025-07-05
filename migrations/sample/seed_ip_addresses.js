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

  // Lấy id các tag theo tên
  const { rows: tagRows } = await pool.query('SELECT id, name FROM tags');
  const tagMap = {};
  tagRows.forEach(tag => { tagMap[tag.name] = tag.id; });

  // Gán tag cho các IP (ví dụ: 2 tag cho mỗi IP đầu tiên)
  // Đảm bảo các tag này tồn tại trong seed_tags.js
  const tagObjectData = [
    { object_id: 1, tag_name: 'Critical' },
    { object_id: 1, tag_name: 'Production' },
    { object_id: 2, tag_name: 'Production' },
    { object_id: 2, tag_name: 'Test' },
    { object_id: 3, tag_name: 'Critical' },
    { object_id: 3, tag_name: 'Test' },
    { object_id: 4, tag_name: 'Critical' },
    { object_id: 4, tag_name: 'Internal' },
    { object_id: 5, tag_name: 'Production' },
    { object_id: 5, tag_name: 'Internal' },
    { object_id: 6, tag_name: 'Test' },
    { object_id: 6, tag_name: 'Internal' },
    { object_id: 7, tag_name: 'Critical' },
    { object_id: 7, tag_name: 'Production' },
    { object_id: 8, tag_name: 'Production' },
    { object_id: 8, tag_name: 'Test' },
    { object_id: 9, tag_name: 'Critical' },
    { object_id: 9, tag_name: 'Test' },
  ];
  for (const row of tagObjectData) {
    const tag_id = tagMap[row.tag_name];
    if (tag_id) {
      await pool.query(
        `INSERT INTO tag_object (object_id, tag_id, object_type) VALUES ($1, $2, 'ip_address') ON CONFLICT DO NOTHING`,
        [row.object_id, tag_id]
      );
    }
  }

  // Seed ip_contact: assign contacts to some IPs (example: 2 contacts per IP for first 10 IPs)
  // Map ip_address to id to always get the correct id
  const { rows: ipRows } = await pool.query('SELECT id, ip_address FROM ip_addresses');
  const ipMap = {};
  ipRows.forEach(ip => { ipMap[ip.ip_address] = ip.id; });

  // Danh sách các IP và contact muốn gán
  const ipContactData = [
    { ip: '192.168.1.1', contacts: [1, 2] },
    { ip: '192.168.1.2', contacts: [2, 3] },
    { ip: '10.0.0.10', contacts: [1, 3] },
    { ip: '10.0.0.11', contacts: [2, 4] },
    { ip: '10.0.0.12', contacts: [1, 4] },
    { ip: '10.0.0.13', contacts: [2, 5] },
    { ip: '10.0.0.14', contacts: [3, 5] },
    { ip: '10.0.0.15', contacts: [1, 5] },
    { ip: '10.0.0.16', contacts: [2, 3] },
    { ip: '10.0.0.17', contacts: [4, 5] },
  ];
  for (const row of ipContactData) {
    const ip_id = ipMap[row.ip];
    if (ip_id) {
      for (const contact_id of row.contacts) {
        await pool.query(
          `INSERT INTO ip_contact (ip_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [ip_id, contact_id]
        );
      }
    }
  }
};