// A component's managers are managers of its system:
//   system_component_contact (component c, contact) => system_contact (c.system_id, contact)
// A system may also have managers that no component has. Every path that
// writes component managers (component form / API / import) calls these
// helpers in its transaction, so the rule always holds.
import { db } from '../../shared/db.js';

// The component's managers become managers of its system.
export async function addToSystem(systemId, contactIds, client) {
  if (!contactIds.length) return;
  await db(client).query(
    'INSERT INTO system_contact (system_id, contact_id) SELECT $1, c FROM unnest($2::int[]) AS c ON CONFLICT DO NOTHING', [systemId, contactIds]);
}

// Managers taken off a component (or a deleted / moved component) leave its
// system too, unless another component of that system still has them.
export async function releaseFromSystem(systemId, contactIds, client) {
  if (!contactIds.length) return;
  await db(client).query(`
    DELETE FROM system_contact x WHERE x.system_id = $1 AND x.contact_id = ANY($2::int[])
      AND NOT EXISTS (SELECT 1 FROM system_component_contact scc JOIN system_components sc ON sc.id = scc.component_id
                      WHERE sc.system_id = $1 AND scc.contact_id = x.contact_id)`, [systemId, contactIds]);
}
