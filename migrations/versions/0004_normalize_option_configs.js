// 0004_normalize_option_configs
// Option-list configuration values get one stored shape,
// [{"value": "...", "label": "..."}], edited by the grid on the System
// Configuration pages. Converts the older shapes still in databases:
//   {"levels": [...]} (system_level, ignored by the app until now),
//   {"types": [...]}, items with "key" instead of "value" (firewall_name),
//   plain strings, and comma-separated text.
// Values that are already in the new shape are rewritten unchanged.
// Also used by migrations/data/migrate_data.js after copying older data.
export const OPTION_KEYS = [
  'system_level', 'system_user_scope', 'system_arch', 'system_app_type',
  'server_type', 'server_status', 'device_status', 'device_location',
  'ip_address_type', 'ip_address_status', 'network_domain_record_type',
  'firewall_name', 'firewall_rule_action', 'firewall_rule_status', 'firewall_rule_violation_type',
  'priv_account_type', 'priv_account_manage_type', 'contact_position', 'pentest_status',
];

function normalize(text) {
  if (text === null || String(text).trim() === '') return [];
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = String(text).split(','); }
  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
    parsed = Object.values(parsed).find(Array.isArray) || [];
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  const seen = new Set();
  const out = [];
  for (const item of parsed) {
    const isObj = item !== null && typeof item === 'object';
    const value = String(isObj ? (item.value ?? item.key ?? '') : (item ?? '')).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const label = isObj ? String(item.label ?? value).trim() : value;
    out.push({ value, label: label || value });
  }
  return out;
}

export async function up(db) {
  const { rows } = await db.query('SELECT key, value FROM configuration WHERE key = ANY($1)', [OPTION_KEYS]);
  for (const { key, value } of rows) {
    const next = JSON.stringify(normalize(value));
    if (next !== value) {
      await db.query('UPDATE configuration SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2', [next, key]);
    }
  }
}
