// migrations/seed_rulefirewall.js
module.exports = async (pool) => {
  // Lấy danh sách id thực tế từ bảng units
  const { rows: unitRows } = await pool.query('SELECT id FROM units ORDER BY id ASC');
  if (!unitRows.length) throw new Error('No units found. Please seed units table first.');
  // Lấy tối đa 5 id, nếu thiếu thì lặp lại id đầu tiên
  const ouIds = unitRows.map(r => r.id);
  function getOuId(idx) {
    return ouIds[idx] || ouIds[0];
  }
  await pool.query(`
    INSERT INTO rulefirewall (
      rulename, firewall_name, src_zone, src, src_detail, dst_zone, dst, dst_detail, services, application, url, action, violation_type, violation_detail, updated_by, ou_id, solution_proposal, solution_confirm, status, description
    ) VALUES
      ('Allow Web', 'FW-01', 'LAN', '192.168.1.0/24', 'All LAN hosts', 'DMZ', '10.0.0.10', 'Web server', '80,443', 'HTTP', 'http://web.example.com', 'allow', 'Policy Violation', 'Access to web server from LAN', 'admin', ${getOuId(0)}, 'Open port 80,443', 'Confirmed by IT', 'active', 'Allow LAN to access web server'),
      ('Block SSH', 'FW-01', 'ANY', '0.0.0.0/0', '', 'DMZ', '10.0.0.10', '', '22', 'SSH', '', 'deny', 'Unauthorized Access', 'Block SSH from Internet', 'admin', ${getOuId(0)}, 'Block port 22', 'Confirmed by Security', 'active', 'Block SSH from Internet'),
      ('Allow DNS', 'FW-02', 'LAN', '192.168.2.0/24', '', 'WAN', '8.8.8.8', '', '53', 'DNS', '', 'allow', 'Policy Exception', 'Allow DNS to Google', 'admin', ${getOuId(1)}, 'Open port 53', 'Confirmed by IT', 'active', 'Allow DNS queries to Google'),
      ('Block FTP', 'FW-02', 'LAN', '192.168.2.0/24', '', 'WAN', '203.0.113.5', '', '21', 'FTP', '', 'deny', 'Unauthorized Service', 'Block FTP to external', 'admin', ${getOuId(1)}, 'Block port 21', 'Confirmed by Security', 'active', 'Block FTP to external server'),
      ('Allow Email', 'FW-03', 'LAN', '10.1.1.0/24', '', 'WAN', 'mail.example.com', '', '25,465,587', 'SMTP', '', 'allow', 'Business Need', 'Allow outgoing email', 'admin', ${getOuId(2)}, 'Open mail ports', 'Confirmed by IT', 'active', 'Allow outgoing email'),
      ('Block Telnet', 'FW-03', 'ANY', '0.0.0.0/0', '', 'LAN', '10.1.1.100', '', '23', 'Telnet', '', 'deny', 'Insecure Protocol', 'Block Telnet access', 'admin', ${getOuId(2)}, 'Block port 23', 'Confirmed by Security', 'active', 'Block Telnet access'),
      ('Allow VPN', 'FW-04', 'WAN', '203.0.113.0/24', '', 'LAN', '10.2.2.0/24', '', '1194', 'OpenVPN', '', 'allow', 'Remote Access', 'Allow VPN from branch', 'admin', ${getOuId(3)}, 'Open port 1194', 'Confirmed by IT', 'active', 'Allow VPN from branch office'),
      ('Block ICMP', 'FW-04', 'ANY', '0.0.0.0/0', '', 'LAN', '10.2.2.1', '', 'ICMP', 'ICMP', '', 'deny', 'Network Policy', 'Block ping to server', 'admin', ${getOuId(3)}, 'Block ICMP', 'Confirmed by Security', 'active', 'Block ping to server'),
      ('Allow App', 'FW-05', 'LAN', '172.16.0.0/16', '', 'DMZ', '172.16.100.10', '', '8080', 'App', '', 'allow', 'Business Need', 'Allow app access', 'admin', ${getOuId(4)}, 'Open port 8080', 'Confirmed by IT', 'active', 'Allow app access'),
      ('Block RDP', 'FW-05', 'ANY', '0.0.0.0/0', '', 'LAN', '172.16.100.20', '', '3389', 'RDP', '', 'deny', 'Unauthorized Access', 'Block RDP from Internet', 'admin', ${getOuId(4)}, 'Block port 3389', 'Confirmed by Security', 'active', 'Block RDP from Internet')
  `);
};
