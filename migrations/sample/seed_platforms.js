export default async (pool) => {
  await pool.query(`
    INSERT INTO platforms (name, description) VALUES
      ('Windows Server 2022', 'Microsoft Windows Server'),
      ('Ubuntu 24.04', 'Ubuntu Linux LTS'),
      ('CentOS Stream 9', 'CentOS Linux Stream'),
      ('Red Hat Enterprise Linux 9', 'RHEL 9'),
      ('Debian 12', 'Debian Linux Stable')
    ON CONFLICT DO NOTHING;
  `);
};