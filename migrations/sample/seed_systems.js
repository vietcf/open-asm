// Seed data for systems, system_server, server_ip (no foreign key constraints)
module.exports = async (db) => {
  // Seed hệ thống
  // Lấy user id và username (giả sử user id=1, username='admin' đã seed ở seed_users.js)
  // Seed hệ thống có updated_by=1, updated_by_username='admin'
  await db.query(`
    INSERT INTO systems (system_id, name, level, department_id, alias, description, updated_by) VALUES
      ('SYS001', 'Quản lý tài khoản', '1', 1, '{"Account Management", "User Access"}', 'Quản lý tài khoản người dùng, phân quyền truy cập.', 'admin'),
      ('SYS002', 'Quản lý thiết bị', '2', 2, '{"Device Management", "Hardware"}', 'Quản lý, kiểm kê, bảo trì thiết bị phần cứng.', 'admin'),
      ('SYS003', 'Quản lý mạng', '1', 3, '{"Network Management", "Infrastructure"}', 'Quản lý hạ tầng mạng, kết nối, bảo mật.', 'admin'),
      ('SYS004', 'Quản lý phần mềm', '2', 1, '{"Software Management", "Application"}', 'Quản lý phần mềm, ứng dụng nội bộ.', 'admin'),
      ('SYS005', 'Quản lý bảo mật', '1', 2, '{"Security", "Access Control"}', 'Giám sát, kiểm soát truy cập và bảo mật.', 'admin')
    ON CONFLICT DO NOTHING;
  `);
  // Seed liên kết hệ thống - server
  await db.query(`
    INSERT INTO system_server (system_id, server_id) VALUES
      (1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (4, 1), (5, 2)
    ON CONFLICT DO NOTHING;
  `);
  // Seed liên kết hệ thống - ip
  await db.query(`
    INSERT INTO system_ip (system_id, ip_id) VALUES
      (1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (4, 6), (5, 7)
    ON CONFLICT DO NOTHING;
  `);
  // Seed liên kết hệ thống - contact
  await db.query(`
    INSERT INTO system_contact (system_id, contact_id) VALUES
      (1, 1), (1, 2), (2, 2), (2, 3), (3, 1), (3, 3), (4, 4), (5, 5)
    ON CONFLICT DO NOTHING;
  `);
  // Seed liên kết hệ thống - domain
  // Lấy id các domain theo tên
  const domRows = await db.query("SELECT id, domain FROM domains WHERE domain IN ('example.com','sub.example.com','myapp.com','testsite.org','demo.net')");
  const domMap = {};
  domRows.rows.forEach(row => { domMap[row.domain] = row.id; });
  // Lấy id các system theo system_id
  const sysRows2 = await db.query("SELECT id, system_id FROM systems WHERE system_id IN ('SYS001','SYS002','SYS003','SYS004','SYS005')");
  const sysMap2 = {};
  sysRows2.rows.forEach(row => { sysMap2[row.system_id] = row.id; });
  // Gán domain cho system (dùng id thực tế, insert từng dòng một để tránh lỗi bind message)
  const domainPairs = [
    [sysMap2['SYS001'], domMap['example.com']],
    [sysMap2['SYS001'], domMap['sub.example.com']],
    [sysMap2['SYS002'], domMap['myapp.com']],
    [sysMap2['SYS003'], domMap['testsite.org']],
    [sysMap2['SYS004'], domMap['demo.net']],
    [sysMap2['SYS005'], domMap['example.com']],
    [sysMap2['SYS003'], domMap['example.com']],
    [sysMap2['SYS002'], domMap['demo.net']]
  ];
  for (const [system_id, domain_id] of domainPairs) {
    if (system_id && domain_id) {
      await db.query('INSERT INTO system_domain (system_id, domain_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [system_id, domain_id]);
    }
  }
  // Dummy seed: Gán tag cho system (giả sử có 5 system và 5 tag)
  // Lấy id các tag theo tên
  const tagRows = await db.query(`SELECT id, name FROM tags WHERE name IN ('Security','Core','Backup','Cloud','Test')`);
  const tagMap = {};
  tagRows.rows.forEach(row => { tagMap[row.name] = row.id; });

  // Lấy id các system theo system_id
  const sysRows = await db.query(`SELECT id, system_id FROM systems WHERE system_id IN ('SYS001','SYS002','SYS003','SYS004','SYS005')`);
  const sysMap = {};
  sysRows.rows.forEach(row => { sysMap[row.system_id] = row.id; });

  // Gán tag cho system (dùng id thực tế, insert từng dòng một để tránh lỗi bind message)
  const tagPairs = [
    [sysMap['SYS001'], tagMap['Security']],
    [sysMap['SYS001'], tagMap['Core']],
    [sysMap['SYS002'], tagMap['Backup']],
    [sysMap['SYS002'], tagMap['Core']],
    [sysMap['SYS003'], tagMap['Cloud']],
    [sysMap['SYS004'], tagMap['Test']],
    [sysMap['SYS005'], tagMap['Security']],
    [sysMap['SYS005'], tagMap['Backup']]
  ];
  for (const [system_id, tag_id] of tagPairs) {
    if (system_id && tag_id) {
      await db.query(
        "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'system', $2) ON CONFLICT DO NOTHING",
        [tag_id, system_id]
      );
    }
  }
};
