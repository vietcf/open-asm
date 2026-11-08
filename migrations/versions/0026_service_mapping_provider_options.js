// 0026_service_mapping_provider_options
// Service mapping providers / channels (virtual_servers.provider) are now a
// System Configuration list, `service_mapping_provider` (Network group); forms,
// Excel import and the REST API only accept its values. Existing data:
//   - no list yet: it is created with every provider already in use (as
//     typed), or Akamai / Cloudflare / VPN / MPLS when none is;
//   - a list already there: providers in use but missing from it are added
//     as retired (records keep them, they can no longer be chosen).
// The values added are printed in the migration output.
const DEFAULTS = ['Akamai', 'Cloudflare', 'VPN', 'MPLS'];

export async function up(db) {
  const { rows: usedRows } = await db.query(
    "SELECT DISTINCT provider FROM virtual_servers WHERE COALESCE(TRIM(provider), '') <> '' ORDER BY provider");
  // one value per case-insensitive spelling (the first one, alphabetically)
  const byLower = new Map();
  for (const r of usedRows) if (!byLower.has(r.provider.trim().toLowerCase())) byLower.set(r.provider.trim().toLowerCase(), r.provider.trim());
  const used = [...byLower.values()];
  const { rows: [row] } = await db.query("SELECT value FROM configuration WHERE key = 'service_mapping_provider'");

  if (!row) {
    const values = used.length ? used : DEFAULTS;
    await db.query(
      "INSERT INTO configuration (key, value, description) VALUES ('service_mapping_provider', $1, 'Service mapping providers / channels')",
      [JSON.stringify(values.map((v) => ({ value: v, label: v })))]);
    console.log(`0026: service_mapping_provider created with ${values.join(', ')}`);
    return;
  }

  let list;
  try { list = JSON.parse(row.value); } catch { list = null; }
  if (!Array.isArray(list)) return;
  const known = new Set(list.map((o) => String(o && typeof o === 'object' ? o.value : o).toLowerCase()));
  const missing = used.filter((v) => !known.has(v.toLowerCase()));
  if (!missing.length) return;
  list.push(...missing.map((v) => ({ value: v, label: v, active: false })));
  await db.query("UPDATE configuration SET value = $1 WHERE key = 'service_mapping_provider'", [JSON.stringify(list)]);
  console.log(`0026: service_mapping_provider: ${missing.join(', ')} added as retired`);
}
