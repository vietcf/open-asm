export default async (db) => {
  await db.query(`
    INSERT INTO services (name, description) VALUES
      ('Web Server', 'Handles HTTP requests and serves web content'),
      ('Database', 'Stores and manages data for applications'),
      ('Email', 'Handles sending and receiving emails'),
      ('DNS', 'Domain Name System service'),
      ('DHCP', 'Dynamic Host Configuration Protocol service'),
      ('FTP', 'File Transfer Protocol service'),
      ('VPN', 'Virtual Private Network service'),
      ('Monitoring', 'System and network monitoring service'),
      ('Backup', 'Data backup and recovery service'),
      ('Proxy', 'Proxy server service')
    ON CONFLICT (name) DO NOTHING;
  `);

  await db.query(`
    INSERT INTO tags (name) VALUES
      ('Security'),
      ('Core'),
      ('Backup'),
      ('Cloud'),
      ('Test')
    ON CONFLICT (name) DO NOTHING;
  `);
};