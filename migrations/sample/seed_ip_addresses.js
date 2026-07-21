export default async (pool) => {
  // server_id here is servers.id, which is not guaranteed to start at 1 on
  // a non-pristine database — look servers up by the names seed_servers.js
  // creates rather than hardcoding literal IDs.
  const { rows: serverRows } = await pool.query(
    "SELECT id, name FROM servers WHERE name IN ('Server A', 'Server B', 'Server C', 'Server D', 'Server E', 'Server F', 'Server G', 'Server H', 'Server I', 'Server J')"
  );
  const s = {};
  serverRows.forEach(r => { s[r.name] = r.id; });

  await pool.query(`
    INSERT INTO ip_addresses (ip_address, description, server_id, updated_by) VALUES
      ('192.168.1.1', 'Main router', NULL, 'admin'),
      ('192.168.1.2', 'Backup router', NULL, 'admin'),
      ('10.0.0.10', 'Web server', ${s['Server A'] || 'NULL'}, 'admin'),
      ('10.0.0.11', 'Database server', ${s['Server A'] || 'NULL'}, 'admin'),
      ('10.0.0.12', 'App server', ${s['Server B'] || 'NULL'}, 'admin'),
      ('10.0.0.13', 'Cache server', ${s['Server B'] || 'NULL'}, 'admin'),
      ('10.0.0.14', 'Mail server', ${s['Server C'] || 'NULL'}, 'admin'),
      ('10.0.0.15', 'Proxy server', ${s['Server C'] || 'NULL'}, 'admin'),
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
      ('192.168.1.10', NULL, ${s['Server A'] || 'NULL'}, 'admin'),
      ('192.168.1.11', NULL, ${s['Server A'] || 'NULL'}, 'admin'),
      ('10.0.0.5', NULL, ${s['Server B'] || 'NULL'}, 'admin'),
      ('10.0.0.6', NULL, ${s['Server B'] || 'NULL'}, 'admin'),
      ('172.16.0.100', NULL, ${s['Server C'] || 'NULL'}, 'admin'),
      ('192.168.2.10', NULL, ${s['Server D'] || 'NULL'}, 'admin'),
      ('192.168.2.11', NULL, ${s['Server D'] || 'NULL'}, 'admin'),
      ('10.0.1.5', NULL, ${s['Server E'] || 'NULL'}, 'admin'),
      ('10.0.1.6', NULL, ${s['Server E'] || 'NULL'}, 'admin'),
      ('172.16.1.100', NULL, ${s['Server F'] || 'NULL'}, 'admin'),
      ('192.168.3.10', NULL, ${s['Server G'] || 'NULL'}, 'admin'),
      ('192.168.3.11', NULL, ${s['Server G'] || 'NULL'}, 'admin'),
      ('10.0.2.5', NULL, ${s['Server H'] || 'NULL'}, 'admin'),
      ('10.0.2.6', NULL, ${s['Server H'] || 'NULL'}, 'admin'),
      ('172.16.2.100', NULL, ${s['Server I'] || 'NULL'}, 'admin'),
      ('192.168.4.10', NULL, ${s['Server J'] || 'NULL'}, 'admin'),
      ('192.168.4.11', NULL, ${s['Server J'] || 'NULL'}, 'admin'),
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

  // contacts.id is not guaranteed to be 1..5 on a non-pristine database,
  // so cycle through whatever contact rows actually exist rather than
  // hardcoding literal IDs.
  const { rows: contactRows } = await pool.query('SELECT id FROM contacts ORDER BY id');
  const contactIds = contactRows.map(c => c.id);
  const pick = (offset, count) => Array.from({ length: count }, (_, k) => contactIds[(offset + k) % contactIds.length]);

  // Danh sách các IP và contact muốn gán
  const ipContactData = contactIds.length > 0 ? [
    { ip: '192.168.1.1', contacts: pick(0, 2) },
    { ip: '192.168.1.2', contacts: pick(1, 2) },
    { ip: '10.0.0.10', contacts: pick(0, 2) },
    { ip: '10.0.0.11', contacts: pick(2, 2) },
    { ip: '10.0.0.12', contacts: pick(0, 2) },
    { ip: '10.0.0.13', contacts: pick(3, 2) },
    { ip: '10.0.0.14', contacts: pick(1, 2) },
    { ip: '10.0.0.15', contacts: pick(4, 2) },
    { ip: '10.0.0.16', contacts: pick(1, 2) },
    { ip: '10.0.0.17', contacts: pick(2, 2) },
  ] : [];
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