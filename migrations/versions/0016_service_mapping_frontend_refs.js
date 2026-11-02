// 0016_service_mapping_frontend_refs
// A service mapping's frontend IP and domain point at the IP address and
// domain inventories instead of being free text: virtual_servers.ip_address
// becomes ip_address_id (required) and domain becomes domain_id (optional).
//
// Existing values are matched by address / name (domains case-insensitively).
// Values not in the inventory yet are created there (IPs without a status,
// domains as record type A) and listed in the migration output.
// Both references are RESTRICT: an IP or domain used by a mapping cannot be
// deleted until the mapping no longer uses it.

export async function up(db) {
  await db.query(`
    ALTER TABLE virtual_servers
      ADD COLUMN ip_address_id INTEGER REFERENCES ip_addresses(id) ON DELETE RESTRICT,
      ADD COLUMN domain_id     INTEGER REFERENCES domains(id) ON DELETE RESTRICT`);

  const { rows: newIps } = await db.query(`
    INSERT INTO ip_addresses (ip_address, description, updated_by)
    SELECT DISTINCT trim(vs.ip_address), 'Created from service mapping', 'migration 0016'
      FROM virtual_servers vs
     WHERE trim(vs.ip_address) <> ''
       AND NOT EXISTS (SELECT 1 FROM ip_addresses i WHERE i.ip_address = trim(vs.ip_address))
    RETURNING ip_address`);
  const { rows: newDomains } = await db.query(`
    INSERT INTO domains (domain, description, record_type)
    SELECT DISTINCT ON (lower(trim(vs.domain))) trim(vs.domain), 'Created from service mapping', 'A'
      FROM virtual_servers vs
     WHERE trim(coalesce(vs.domain, '')) <> ''
       AND NOT EXISTS (SELECT 1 FROM domains d WHERE lower(d.domain) = lower(trim(vs.domain)))
     ORDER BY lower(trim(vs.domain)), vs.id
    RETURNING domain`);
  if (newIps.length) console.warn(`0016: created ${newIps.length} IP address(es) used by service mappings: ${newIps.map((r) => r.ip_address).join(', ')}`);
  if (newDomains.length) console.warn(`0016: created ${newDomains.length} domain(s) used by service mappings: ${newDomains.map((r) => r.domain).join(', ')}`);

  await db.query(`
    UPDATE virtual_servers vs SET
      ip_address_id = (SELECT i.id FROM ip_addresses i WHERE i.ip_address = trim(vs.ip_address)),
      domain_id = (SELECT d.id FROM domains d WHERE lower(d.domain) = lower(trim(vs.domain)) ORDER BY d.id LIMIT 1)`);

  await db.query('DROP INDEX IF EXISTS idx_vs_domain');
  await db.query('DROP INDEX IF EXISTS idx_vs_ip');
  await db.query(`
    ALTER TABLE virtual_servers
      DROP COLUMN ip_address,
      DROP COLUMN domain,
      ALTER COLUMN ip_address_id SET NOT NULL`);
  await db.query('CREATE INDEX idx_vs_ip_address ON virtual_servers (ip_address_id)');
  await db.query('CREATE INDEX idx_vs_domain_id ON virtual_servers (domain_id)');
}
