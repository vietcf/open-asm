// A component's IP addresses are IP addresses of its system:
//   system_component_ip (component c, ip) => system_ip (c.system_id, ip)
// A system may also have IPs that no component uses. Every path that writes
// these links (component, system and IP address forms / API / import) calls
// these helpers in its transaction, so the rule always holds.
import { db } from '../../shared/db.js';

// The component's IPs become IPs of its system.
export async function addToSystem(systemId, ipIds, client) {
  if (!ipIds.length) return;
  await db(client).query(
    'INSERT INTO system_ip (system_id, ip_id) SELECT $1, ip FROM unnest($2::int[]) AS ip ON CONFLICT DO NOTHING', [systemId, ipIds]);
}

// IPs taken off a component (or a deleted / moved component) leave its system
// too, unless another component of that system still uses them.
export async function releaseFromSystem(systemId, ipIds, client) {
  if (!ipIds.length) return;
  await db(client).query(`
    DELETE FROM system_ip si WHERE si.system_id = $1 AND si.ip_id = ANY($2::int[])
      AND NOT EXISTS (SELECT 1 FROM system_component_ip sci JOIN system_components sc ON sc.id = sci.component_id
                      WHERE sc.system_id = $1 AND sci.ip_id = si.ip_id)`, [systemId, ipIds]);
}

// After a system's or an IP's system links changed: component links whose IP
// is no longer an IP of the component's system are removed.
// scope: { systemId } or { ipId }
export async function dropComponentIpsOutsideSystem({ systemId = null, ipId = null }, client) {
  await db(client).query(`
    DELETE FROM system_component_ip sci USING system_components sc
     WHERE sc.id = sci.component_id
       AND ($1::int IS NULL OR sc.system_id = $1) AND ($2::int IS NULL OR sci.ip_id = $2)
       AND NOT EXISTS (SELECT 1 FROM system_ip si WHERE si.system_id = sc.system_id AND si.ip_id = sci.ip_id)`,
  [systemId, ipId]);
}
