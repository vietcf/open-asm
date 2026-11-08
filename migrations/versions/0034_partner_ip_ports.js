// 0034_partner_ip_ports
// Outbound flows: internal source IPs (no port) -> one NAT IP (partner
// connectivity) or one egress public IP (internet connectivity) -> each
// partner IP with its own port and protocol, and for internet connectivity an
// optional domain. No NAT range and no gateway / proxy IP any more: the NAT /
// egress IP sits on its FW device, shown through the asset mapping.
//   virtual_server_partner_ips.port / .protocol / .domain
//   virtual_servers.port / .protocol may be empty (outbound flows keep them on their partner IPs)
//   virtual_servers.nat_subnet_id, .gateway_ip_address_id dropped (they held no data)
// Existing data: the port / protocol (and for internet connectivity the domain)
// of every outbound mapping are copied to its partner IPs and emptied on the
// mapping; the ports of the outbound source IPs are emptied. Counts are printed.

export async function up(db) {
  await db.query(`
    ALTER TABLE virtual_server_partner_ips
      ADD COLUMN port INTEGER CHECK (port BETWEEN 1 AND 65535),
      ADD COLUMN protocol VARCHAR(10),
      ADD COLUMN domain VARCHAR(255);
    ALTER TABLE virtual_servers
      ALTER COLUMN port DROP NOT NULL,
      ALTER COLUMN protocol DROP NOT NULL;
  `);
  const { rowCount: copied } = await db.query(`
    UPDATE virtual_server_partner_ips p
       SET port = vs.port, protocol = vs.protocol,
           domain = CASE WHEN vs.scope = 'public' THEN (SELECT d.domain FROM domains d WHERE d.id = vs.domain_id) END
      FROM virtual_servers vs
     WHERE vs.id = p.virtual_server_id AND vs.direction = 'outbound'`);
  await db.query("UPDATE virtual_servers SET port = NULL, protocol = NULL, domain_id = NULL WHERE direction = 'outbound'");
  const { rowCount: sources } = await db.query(`
    UPDATE virtual_server_members m SET port = NULL FROM virtual_servers vs
     WHERE vs.id = m.virtual_server_id AND vs.direction = 'outbound' AND m.port IS NOT NULL`);
  await db.query('DROP INDEX IF EXISTS idx_vs_nat_subnet');
  await db.query('DROP INDEX IF EXISTS idx_vs_gateway_ip');
  await db.query('ALTER TABLE virtual_servers DROP COLUMN nat_subnet_id, DROP COLUMN gateway_ip_address_id');
  if (copied || sources) console.log(`0034: ${copied} partner IP(s) got their mapping's port / protocol / domain, ${sources} outbound source port(s) emptied`);
}
