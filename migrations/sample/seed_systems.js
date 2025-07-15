// Seed data for systems, system_server, server_ip (no foreign key constraints)
export default async (db) => {
  // Seed hệ thống
  // Lấy user id và username (giả sử user id=1, username='admin' đã seed ở seed_users.js)
  // Seed hệ thống có updated_by=1, updated_by_username='admin'
  // Lấy id các department (unit) theo tên hoặc code
  const { rows: unitRows } = await db.query("SELECT id, name, code FROM units");
  const unitMap = {};
  unitRows.forEach(u => { unitMap[u.code] = u.id; });

  // Map code cho từng hệ thống
  const systemsData = [
    { system_id: 'SYS001', name: 'Quản lý tài khoản', level: '1', department_code: 'IT', alias: '{"Account Management", "User Access"}', description: 'Quản lý tài khoản người dùng, phân quyền truy cập.', updated_by: 'admin' },
    { system_id: 'SYS002', name: 'Quản lý thiết bị', level: '2', department_code: 'HR', alias: '{"Device Management", "Hardware"}', description: 'Quản lý, kiểm kê, bảo trì thiết bị phần cứng.', updated_by: 'admin' },
    { system_id: 'SYS003', name: 'Quản lý mạng', level: '1', department_code: 'FIN', alias: '{"Network Management", "Infrastructure"}', description: 'Quản lý hạ tầng mạng, kết nối, bảo mật.', updated_by: 'admin' },
    { system_id: 'SYS004', name: 'Quản lý phần mềm', level: '2', department_code: 'IT', alias: '{"Software Management", "Application"}', description: 'Quản lý phần mềm, ứng dụng nội bộ.', updated_by: 'admin' },
    { system_id: 'SYS005', name: 'Quản lý bảo mật', level: '1', department_code: 'HR', alias: '{"Security", "Access Control"}', description: 'Giám sát, kiểm soát truy cập và bảo mật.', updated_by: 'admin' },
  ];
  for (const sys of systemsData) {
    const department_id = unitMap[sys.department_code];
    if (department_id) {
      await db.query(
        `INSERT INTO systems (system_id, name, level, department_id, alias, description, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING;`,
        [sys.system_id, sys.name, sys.level, department_id, sys.alias, sys.description, sys.updated_by]
      );
    }
  }
  // Lấy id các system theo system_id cho server/ip/contact
  const sysRowsMain = await db.query("SELECT id, system_id FROM systems WHERE system_id IN ('SYS001','SYS002','SYS003','SYS004','SYS005')");
  const sysMapMain = {};
  sysRowsMain.rows.forEach(row => { sysMapMain[row.system_id] = row.id; });

  // Lấy id các server theo tên (giả sử tên server là duy nhất)
  const serverRows = await db.query("SELECT id, name FROM servers WHERE name IN ('Server A','Server B','Server C','Server D','Server E')");
  const serverMap = {};
  serverRows.rows.forEach(row => { serverMap[row.name] = row.id; });

  // Lấy id các ip theo địa chỉ
  const ipRows = await db.query("SELECT id, ip_address FROM ip_addresses WHERE ip_address IN ('192.168.1.1','192.168.1.2','10.0.0.10','10.0.0.11','10.0.0.12','10.0.0.13','10.0.0.14')");
  const ipMap = {};
  ipRows.rows.forEach(row => { ipMap[row.ip_address] = row.id; });

  // Lấy id các contact theo tên (giả sử tên là duy nhất)
  const contactRows = await db.query("SELECT id, name FROM contacts WHERE name IN ('Nguyen Van A','Tran Thi B','Le Van C','Pham Thi D','Hoang Van E')");
  const contactMap = {};
  contactRows.rows.forEach(row => { contactMap[row.name] = row.id; });

  // Seed liên kết hệ thống - server
  const systemServerData = [
    [sysMapMain['SYS001'], serverMap['Server A']],
    [sysMapMain['SYS001'], serverMap['Server B']],
    [sysMapMain['SYS002'], serverMap['Server C']],
    [sysMapMain['SYS002'], serverMap['Server D']],
    [sysMapMain['SYS003'], serverMap['Server E']],
    [sysMapMain['SYS004'], serverMap['Server A']],
    [sysMapMain['SYS005'], serverMap['Server B']],
  ];
  for (const [system_id, server_id] of systemServerData) {
    if (system_id && server_id) {
      await db.query('INSERT INTO system_server (system_id, server_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [system_id, server_id]);
    }
  }

  // Seed liên kết hệ thống - ip
  const systemIpData = [
    [sysMapMain['SYS001'], ipMap['192.168.1.1']],
    [sysMapMain['SYS001'], ipMap['192.168.1.2']],
    [sysMapMain['SYS002'], ipMap['10.0.0.10']],
    [sysMapMain['SYS002'], ipMap['10.0.0.11']],
    [sysMapMain['SYS003'], ipMap['10.0.0.12']],
    [sysMapMain['SYS004'], ipMap['10.0.0.13']],
    [sysMapMain['SYS005'], ipMap['10.0.0.14']],
  ];
  for (const [system_id, ip_id] of systemIpData) {
    if (system_id && ip_id) {
      await db.query('INSERT INTO system_ip (system_id, ip_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [system_id, ip_id]);
    }
  }

  // Seed liên kết hệ thống - contact
  const systemContactData = [
    [sysMapMain['SYS001'], contactMap['Nguyen Van A']],
    [sysMapMain['SYS001'], contactMap['Tran Thi B']],
    [sysMapMain['SYS002'], contactMap['Tran Thi B']],
    [sysMapMain['SYS002'], contactMap['Le Van C']],
    [sysMapMain['SYS003'], contactMap['Nguyen Van A']],
    [sysMapMain['SYS003'], contactMap['Le Van C']],
    [sysMapMain['SYS004'], contactMap['Pham Thi D']],
    [sysMapMain['SYS005'], contactMap['Hoang Van E']],
  ];
  for (const [system_id, contact_id] of systemContactData) {
    if (system_id && contact_id) {
      await db.query('INSERT INTO system_contact (system_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [system_id, contact_id]);
    }
  }
  // Seed liên kết hệ thống - domain
  // Lấy id các domain theo tên
  const domRows = await db.query("SELECT id, domain FROM domains WHERE domain IN ('example.com','sub.example.com','myapp.com','testsite.org','demo.net')");
  const domMap = {};
  domRows.rows.forEach(row => { domMap[row.domain] = row.id; });
  // Lấy id các system theo system_id cho domain
  const sysRowsDomain = await db.query("SELECT id, system_id FROM systems WHERE system_id IN ('SYS001','SYS002','SYS003','SYS004','SYS005')");
  const sysMapDomain = {};
  sysRowsDomain.rows.forEach(row => { sysMapDomain[row.system_id] = row.id; });
  // Gán domain cho system (dùng id thực tế, insert từng dòng một để tránh lỗi bind message)
  const domainPairs = [
    [sysMapDomain['SYS001'], domMap['example.com']],
    [sysMapDomain['SYS001'], domMap['sub.example.com']],
    [sysMapDomain['SYS002'], domMap['myapp.com']],
    [sysMapDomain['SYS003'], domMap['testsite.org']],
    [sysMapDomain['SYS004'], domMap['demo.net']],
    [sysMapDomain['SYS005'], domMap['example.com']],
    [sysMapDomain['SYS003'], domMap['example.com']],
    [sysMapDomain['SYS002'], domMap['demo.net']]
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

  // Lấy id các system theo system_id cho tag
  const sysRowsTag = await db.query(`SELECT id, system_id FROM systems WHERE system_id IN ('SYS001','SYS002','SYS003','SYS004','SYS005')`);
  const sysMapTag = {};
  sysRowsTag.rows.forEach(row => { sysMapTag[row.system_id] = row.id; });

  // Gán tag cho system (dùng id thực tế, insert từng dòng một để tránh lỗi bind message)
  const tagPairs = [
    [sysMapTag['SYS001'], tagMap['Security']],
    [sysMapTag['SYS001'], tagMap['Core']],
    [sysMapTag['SYS002'], tagMap['Backup']],
    [sysMapTag['SYS002'], tagMap['Core']],
    [sysMapTag['SYS003'], tagMap['Cloud']],
    [sysMapTag['SYS004'], tagMap['Test']],
    [sysMapTag['SYS005'], tagMap['Security']],
    [sysMapTag['SYS005'], tagMap['Backup']]
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
