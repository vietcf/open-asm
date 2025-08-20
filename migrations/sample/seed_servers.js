// Seed data for servers table (new structure)
export default async (db) => {
  // Giả sử đã có sẵn platforms và systems, lấy id tương ứng
  // Ví dụ: Ubuntu 22.04 (id=1), Windows Server 2019 (id=2), CentOS 7 (id=3)
  // Seed servers
  await db.query('DELETE FROM server_agents;');
  await db.query('DELETE FROM server_services;');
  await db.query('DELETE FROM server_system;');
  await db.query('DELETE FROM server_contact;');
  await db.query('DELETE FROM servers;');
  await db.query("ALTER SEQUENCE servers_id_seq RESTART WITH 1;");
  await db.query(`
    INSERT INTO servers (name, os_id, location, type, status, updated_by)
    VALUES
      ('Server A', 1, 'Data Center 1', 'Vật lý', 'online', 'admin'),
      ('Server B', 2, 'Data Center 2', 'Cloud', 'offline', 'admin'),
      ('Server C', 3, 'Data Center 1', 'Ảo hóa', 'online', 'admin'),
      ('Server D', 1, 'Data Center 3', 'Cloud', 'offline', 'admin'),
      ('Server E', 2, 'Data Center 2', 'Vật lý', 'online', 'admin'),
      ('Server F', 3, 'Data Center 1', 'Ảo hóa', 'offline', 'admin'),
      ('Server G', 1, 'Data Center 4', 'Cloud', 'online', 'admin'),
      ('Server H', 2, 'Data Center 3', 'Vật lý', 'offline', 'admin'),
      ('Server I', 3, 'Data Center 2', 'Ảo hóa', 'online', 'admin'),
      ('Server J', 1, 'Data Center 1', 'Cloud', 'offline', 'admin'),
      ('Server K', 2, NULL, 'Cloud', 'online', 'admin'),
      ('Server L', NULL, 'Data Center 5', NULL, 'offline', 'admin'),
      ('Server M', 1, NULL, 'Vật lý', NULL, 'admin'),
      ('Server N', NULL, NULL, NULL, 'online', 'admin'),
      ('Server O', 3, 'Data Center 6', NULL, 'offline', 'admin'),
      ('Server P', NULL, 'Data Center 7', 'Cloud', NULL, 'admin'),
      ('Server Q', 2, NULL, NULL, 'online', 'admin'),
      ('Server R', NULL, NULL, 'Ảo hóa', 'offline', 'admin'),
      ('Server S', 1, 'Data Center 8', NULL, NULL, 'admin'),
      ('Server T', NULL, NULL, NULL, NULL, 'admin')
  `);
  // Seed server_agents (mỗi server chỉ có 2-3 agent, id 1-10)
  await db.query(`
    INSERT INTO server_agents (server_id, agent_id) VALUES
      (1, 1), (1, 2),
      (2, 3), (2, 4),
      (3, 5), (3, 6), (3, 7),
      (4, 8), (4, 9),
      (5, 10), (5, 1),
      (6, 2), (6, 3),
      (7, 4), (7, 5), (7, 6),
      (8, 7), (8, 8),
      (9, 9), (9, 10),
      (10, 1), (10, 2), (10, 3)
    ON CONFLICT DO NOTHING;
  `);
  // Seed server_services (giả sử có 10 service, id 1-10)
  await db.query(`
    INSERT INTO server_services (server_id, service_id) VALUES
      (1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (3, 6),
      (4, 7), (4, 8), (5, 9), (5, 10), (6, 1), (6, 3),
      (7, 2), (7, 4), (8, 5), (8, 7), (9, 6), (9, 8), (10, 9), (10, 10)
    ON CONFLICT DO NOTHING;
  `);
  // Seed server_system (mỗi server chỉ liên kết với tối đa 2 system)
  await db.query(`
    INSERT INTO server_system (server_id, system_id) VALUES
      (1, 1), (1, 2),
      (2, 2),
      (3, 3),
      (4, 4),
      (5, 5),
      (6, 1), (6, 3),
      (7, 2),
      (8, 4),
      (9, 5),
      (10, 1), (10, 2)
    ON CONFLICT DO NOTHING;
  `);
  // Seed server_contact (giả sử có 10 server và 5 contact, mỗi server có 1 manager)
  await db.query(`
    INSERT INTO server_contact (server_id, contact_id) VALUES
      (1, 1),
      (2, 2),
      (3, 3),
      (4, 4),
      (5, 5),
      (6, 1),
      (7, 2),
      (8, 3),
      (9, 4),
      (10, 5)
    ON CONFLICT DO NOTHING;
  `);
  // Remove seed for server_ip (no longer needed)
};
