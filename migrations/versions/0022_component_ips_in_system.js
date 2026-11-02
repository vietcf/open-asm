// 0022_component_ips_in_system
// A component's IP addresses are IP addresses of its system (the app keeps
// this from now on, see src/modules/system/system-ip-links.js). Existing data:
//   1. system_ip had no unique constraint: duplicate (system, IP) rows are
//      removed (the oldest is kept) and the constraint is added;
//   2. component IPs missing from their system are added to it.
// Both counts are printed in the migration output.

export async function up(db) {
  const { rowCount: duplicates } = await db.query(`
    DELETE FROM system_ip a USING system_ip b
     WHERE a.system_id = b.system_id AND a.ip_id = b.ip_id AND a.id > b.id`);
  await db.query('DELETE FROM system_ip WHERE system_id IS NULL OR ip_id IS NULL');
  await db.query('ALTER TABLE system_ip ADD CONSTRAINT system_ip_system_id_ip_id_key UNIQUE (system_id, ip_id)');

  const { rowCount: added } = await db.query(`
    INSERT INTO system_ip (system_id, ip_id)
    SELECT DISTINCT sc.system_id, sci.ip_id
      FROM system_component_ip sci JOIN system_components sc ON sc.id = sci.component_id
     WHERE sc.system_id IS NOT NULL
    ON CONFLICT (system_id, ip_id) DO NOTHING`);
  if (duplicates || added) {
    console.log(`0022: system_ip: ${duplicates} duplicate link(s) removed, ${added} component IP link(s) added to their system`);
  }
}
