// 0015_service_mapping_members_by_ip
// Service mapping members point at an IP address (a load-balancer pool member
// is IP:port) instead of a server: a server can have several IPs, and a member
// IP may not belong to any server. The server is derived from the IP's owner.
//
// Existing members get their server's IP: its own (role 'normal') IP from
// server_ip first, then any other server_ip row, then the legacy
// ip_addresses.server_id column (when it still exists), lowest id first.
// Members whose server has no IP at all cannot be kept: they are listed in the
// migration output and removed.
// The IP reference is RESTRICT: an IP used as a backend must be removed from
// the mapping before it can be deleted.

export async function up(db) {
  const { rows: [legacy] } = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'ip_addresses' AND column_name = 'server_id'`);

  await db.query('ALTER TABLE virtual_server_members ADD COLUMN ip_address_id INTEGER REFERENCES ip_addresses(id) ON DELETE RESTRICT');
  await db.query(`
    UPDATE virtual_server_members m SET ip_address_id = COALESCE(
      (SELECT si.ip_id FROM server_ip si WHERE si.server_id = m.server_id ORDER BY (si.role = 'normal') DESC, si.ip_id LIMIT 1)
      ${legacy ? ', (SELECT i.id FROM ip_addresses i WHERE i.server_id = m.server_id ORDER BY i.id LIMIT 1)' : ''})`);

  const { rows: lost } = await db.query(`
    SELECT vs.name AS mapping, s.name AS server FROM virtual_server_members m
      JOIN virtual_servers vs ON vs.id = m.virtual_server_id
      JOIN servers s ON s.id = m.server_id
     WHERE m.ip_address_id IS NULL ORDER BY vs.name, s.name`);
  if (lost.length) {
    console.warn(`0015: removed ${lost.length} service mapping member(s) whose server has no IP address:`);
    for (const r of lost) console.warn(`  ${r.mapping} -> ${r.server}`);
  }
  await db.query('DELETE FROM virtual_server_members WHERE ip_address_id IS NULL');

  // Two servers may have resolved to the same IP: keep one row per (mapping, IP, port)
  await db.query(`
    DELETE FROM virtual_server_members a USING virtual_server_members b
     WHERE a.virtual_server_id = b.virtual_server_id AND a.ip_address_id = b.ip_address_id
       AND a.port IS NOT DISTINCT FROM b.port AND a.server_id > b.server_id`);

  await db.query(`
    ALTER TABLE virtual_server_members
      DROP CONSTRAINT virtual_server_members_pkey,
      DROP COLUMN server_id,
      ALTER COLUMN ip_address_id SET NOT NULL,
      ADD COLUMN id SERIAL PRIMARY KEY`);
  // The same IP may serve one mapping on several ports
  await db.query('CREATE UNIQUE INDEX uq_vsm_member ON virtual_server_members (virtual_server_id, ip_address_id, port) NULLS NOT DISTINCT');
  await db.query('DROP INDEX IF EXISTS idx_vsm_server');
  await db.query('CREATE INDEX idx_vsm_ip ON virtual_server_members (ip_address_id)');
}
