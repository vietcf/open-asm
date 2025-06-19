module.exports = async (db) => {
  // Lấy id các ip_address để gán cho domain
  const ipRows = await db.query(`SELECT id, ip_address FROM ip_addresses WHERE ip_address IN ('10.0.0.10','10.0.0.11','192.168.1.1')`);
  const ipMap = {};
  ipRows.rows.forEach(row => { ipMap[row.ip_address] = row.id; });

  // Seed domains với đủ các trường
  await db.query(`
    INSERT INTO domains (domain, description, ip_id, record_type) VALUES
      ('example.com', 'Main company domain', $1, 'A'),
      ('sub.example.com', 'Subdomain for internal services', $2, 'A'),
      ('myapp.com', 'Domain for MyApp product', $3, 'CNAME'),
      ('testsite.org', 'Testing and QA domain', NULL, 'A'),
      ('demo.net', 'Demo and showcase domain', NULL, 'AAAA')
    ON CONFLICT (domain) DO NOTHING;
  `, [ipMap['10.0.0.10'] || null, ipMap['10.0.0.11'] || null, ipMap['192.168.1.1'] || null]);

  // Lấy id các system và domain sau khi đã insert xong
  const sysRows = await db.query(`SELECT id, system_id FROM systems WHERE system_id IN ('SYS001','SYS002','SYS003','SYS004','SYS005')`);
  const domRows = await db.query(`SELECT id, domain FROM domains WHERE domain IN ('example.com','sub.example.com','myapp.com','testsite.org','demo.net')`);
  const sysMap = {};
  sysRows.rows.forEach(row => { sysMap[row.system_id] = row.id; });
  const domMap = {};
  domRows.rows.forEach(row => { domMap[row.domain] = row.id; });

  // Gán domain cho system (chỉ insert nếu cả 2 id đều tồn tại)
  const pairs = [
    [sysMap['SYS001'], domMap['example.com']],
    [sysMap['SYS001'], domMap['sub.example.com']],
    [sysMap['SYS002'], domMap['myapp.com']],
    [sysMap['SYS003'], domMap['testsite.org']],
    [sysMap['SYS004'], domMap['demo.net']],
    [sysMap['SYS005'], domMap['example.com']],
    [sysMap['SYS003'], domMap['example.com']],
    [sysMap['SYS002'], domMap['demo.net']]
  ];
  for (const [system_id, domain_id] of pairs) {
    if (system_id && domain_id) {
      await db.query('INSERT INTO system_domain (system_id, domain_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [system_id, domain_id]);
    }
  }
};
