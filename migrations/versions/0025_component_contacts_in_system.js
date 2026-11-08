// 0025_component_contacts_in_system
// A component's managers are managers of its system (the app keeps this from
// now on, see src/modules/system/system-contact-links.js). Existing data:
//   1. system_contact had no unique constraint: duplicate (system, contact)
//      rows are removed (the oldest is kept) and the constraint is added;
//   2. component managers missing from their system are added to it.
// Both counts are printed in the migration output.

export async function up(db) {
  const { rowCount: duplicates } = await db.query(`
    DELETE FROM system_contact a USING system_contact b
     WHERE a.system_id = b.system_id AND a.contact_id = b.contact_id AND a.id > b.id`);
  await db.query('DELETE FROM system_contact WHERE system_id IS NULL OR contact_id IS NULL');
  await db.query('ALTER TABLE system_contact ADD CONSTRAINT system_contact_system_id_contact_id_key UNIQUE (system_id, contact_id)');

  const { rowCount: added } = await db.query(`
    INSERT INTO system_contact (system_id, contact_id)
    SELECT DISTINCT sc.system_id, scc.contact_id
      FROM system_component_contact scc JOIN system_components sc ON sc.id = scc.component_id
     WHERE sc.system_id IS NOT NULL
    ON CONFLICT (system_id, contact_id) DO NOTHING`);
  if (duplicates || added) {
    console.log(`0025: system_contact: ${duplicates} duplicate link(s) removed, ${added} component manager link(s) added to their system`);
  }
}
