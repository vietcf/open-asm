// 0020_retired_option_values
// Option lists can now hold retired values ({"value", "label", "active": false}):
// records keep them, they can no longer be chosen. Values removed from a list
// before this version may still be used by records; they are added back to
// their list as retired (label = value), so those records show and save
// correctly. Lists that are empty or missing stay as they are (an empty list
// accepts any value). The added values are listed in the migration output.
//
// Same columns as `usedBy` in src/utils/configRegistry.js at this version.
const USED_BY = {
  system_level: [['systems', 'level']],
  system_user_scope: [['systems', 'scopes', true]],
  system_arch: [['systems', 'architecture', true]],
  system_app_type: [['system_components', 'app_type']],
  server_type: [['servers', 'type']],
  server_status: [['servers', 'status']],
  device_location: [['servers', 'location'], ['devices', 'location']],
  ip_address_status: [['ip_addresses', 'status']],
  network_domain_record_type: [['domains', 'record_type']],
  firewall_name: [['rulefirewall', 'firewall_name']],
  firewall_rule_action: [['rulefirewall', 'action']],
  firewall_rule_status: [['rulefirewall', 'status']],
  firewall_rule_violation_type: [['rulefirewall', 'violation_type']],
  priv_account_type: [['priv_users', 'account_type']],
  priv_account_manage_type: [['priv_users', 'manage_type']],
  contact_position: [['contacts', 'position']],
  pentest_status: [['pentest_rounds', 'status']],
};

export async function up(db) {
  for (const [key, uses] of Object.entries(USED_BY)) {
    const { rows: [row] } = await db.query('SELECT value FROM configuration WHERE key = $1', [key]);
    let list;
    try { list = row ? JSON.parse(row.value) : null; } catch { list = null; }
    if (!Array.isArray(list) || !list.length) continue;
    // stored by 0004 as [{value, label}]; firewall values are matched case-insensitively by the app
    const known = new Set(list.map((o) => String(o && typeof o === 'object' ? o.value : o).toLowerCase()));
    const used = new Set();
    for (const [table, column, multi] of uses) {
      const sql = multi
        ? `SELECT DISTINCT v FROM ${table}, jsonb_array_elements_text(CASE WHEN jsonb_typeof(${column}) = 'array' THEN ${column} ELSE '[]'::jsonb END) AS v`
        : `SELECT DISTINCT ${column}::text AS v FROM ${table} WHERE ${column} IS NOT NULL AND trim(${column}::text) <> ''`;
      for (const { v } of (await db.query(sql)).rows) used.add(v);
    }
    const missing = [...used].filter((v) => !known.has(v.toLowerCase())).sort();
    if (!missing.length) continue;
    const updated = [...list, ...missing.map((v) => ({ value: v, label: v, active: false }))];
    await db.query('UPDATE configuration SET value = $1, updated_at = NOW() WHERE key = $2', [JSON.stringify(updated), key]);
    console.log(`0020: ${key}: retired values added for existing records: ${missing.join(', ')}`);
  }
}
