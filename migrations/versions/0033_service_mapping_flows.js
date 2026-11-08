// 0033_service_mapping_flows
// Service mappings follow four flows (direction x scope):
//   1 inbound  public   Public Exposure:      users / partners -> domain -> CDN -> public IP:port -> NAT / reverse proxy -> backends
//   2 inbound  private  Private Connectivity: partner VPN IPs -> VPN / lease line -> NAT service IP:port -> backends
//   3 outbound private  Partner Connectivity: internal IPs -> NAT IP (NAT range) -> VPN / lease line -> partner IP:port
//   4 outbound public   Internet Connectivity: internal IPs -> firewall / proxy -> egress public IP -> internet IP (domain):port
// Schema:
//   virtual_server_partner_ips   partner IPs / CIDRs with the partner's name:
//       the allowed sources of flows 1 (limited) and 2, the destinations of 3 and 4
//   virtual_servers.nat_subnet_id         NAT range (subnet) of flows 2 and 3
//   virtual_servers.gateway_ip_address_id NAT / reverse proxy (1) or firewall / NAT gateway / proxy (4)
//   virtual_servers.ip_address_id         our IP: public (1), NAT service (2), NAT (3), egress (4); may be empty for 3
//   configuration service_mapping_partner  list of partner names (empty = any)
// Existing data:
//   - allowed_ips become partner IP rows (no partner name); the column is dropped;
//   - outbound mappings used ip_address_id as the destination: it becomes a
//     partner IP row and ip_address_id is emptied (set the NAT / egress IP when
//     editing them).
// Counts are printed in the migration output.

export async function up(db) {
  await db.query(`
    CREATE TABLE virtual_server_partner_ips (
      id SERIAL PRIMARY KEY,
      virtual_server_id INTEGER NOT NULL REFERENCES virtual_servers(id) ON DELETE CASCADE,
      address VARCHAR(64) NOT NULL,
      partner VARCHAR(100),
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_vs_partner_ips_vs ON virtual_server_partner_ips (virtual_server_id, position);
    CREATE INDEX idx_vs_partner_ips_partner ON virtual_server_partner_ips (partner);

    ALTER TABLE virtual_servers
      ADD COLUMN nat_subnet_id INTEGER REFERENCES subnets(id) ON DELETE SET NULL,
      ADD COLUMN gateway_ip_address_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL,
      ALTER COLUMN ip_address_id DROP NOT NULL;
    CREATE INDEX idx_vs_nat_subnet ON virtual_servers (nat_subnet_id);
    CREATE INDEX idx_vs_gateway_ip ON virtual_servers (gateway_ip_address_id);
  `);

  const { rowCount: allowed } = await db.query(`
    INSERT INTO virtual_server_partner_ips (virtual_server_id, address, position)
    SELECT vs.id, TRIM(a.ip), a.n - 1
      FROM virtual_servers vs, unnest(vs.allowed_ips) WITH ORDINALITY AS a(ip, n)
     WHERE COALESCE(TRIM(a.ip), '') <> ''`);

  const { rowCount: outbound } = await db.query(`
    INSERT INTO virtual_server_partner_ips (virtual_server_id, address, position)
    SELECT vs.id, ip.ip_address, 1000
      FROM virtual_servers vs JOIN ip_addresses ip ON ip.id = vs.ip_address_id
     WHERE vs.direction = 'outbound'`);
  await db.query("UPDATE virtual_servers SET ip_address_id = NULL WHERE direction = 'outbound'");

  await db.query('ALTER TABLE virtual_servers DROP COLUMN allowed_ips');

  await db.query(`INSERT INTO configuration (key, value, description)
    VALUES ('service_mapping_partner', '[]', 'Service mapping partners')
    ON CONFLICT (key) DO NOTHING`);

  if (allowed || outbound) {
    console.log(`0033: ${allowed} allowed IP(s) and ${outbound} outbound destination(s) moved to partner IPs`);
  }
}
