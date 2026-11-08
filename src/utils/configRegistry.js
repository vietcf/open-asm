// Known configuration keys, grouped for the System Configuration pages.
// Values stay in the `configuration` table (key -> text value); this file
// only says how each key is edited and validated, so no consumer changes.
//
// Field types:
//   text      plain string
//   number    integer >= min
//   select    one of `choices`
//   int_list  comma-separated positive integers, unique, ascending ("10,20,50")
//   options   option list, stored as JSON [{"value","label"}, ...]; an item
//             with "active": false is retired: records keep it, it can no
//             longer be chosen. `usedBy` lists the table columns holding its
//             values (multi: a JSONB array of values), for the usage counts
//             and the "replace with" of the editor (src/utils/optionUsage.js).
//
// Only the keys listed here can be written from the UI (there is no raw
// key/value editor). `label` / `help` are English i18n keys.

export const CONFIG_GROUPS = [
  {
    id: 'general', section: 'Application', label: 'General', icon: 'bi-sliders',
    fields: [
      { key: 'site_name', type: 'text', label: 'Site name', help: 'Shown in the header and page titles', required: true },
      { key: 'page_size', type: 'int_list', label: 'Page size options', help: 'Rows per page offered on list pages; the first one is the default', required: true },
    ],
  },
  {
    id: 'security', section: 'Application', label: 'Security & Logs', icon: 'bi-shield-lock',
    fields: [
      { key: 'session_idle_timeout_minutes', type: 'number', min: 0, max: 10080, default: '30', label: 'Session idle timeout (minutes)', help: '0 disables the automatic logout' },
      { key: 'otp_deadline_time', type: 'number', min: 1, max: 365, default: '3', label: '2FA setup deadline (days)', help: 'Days a user has to set up 2FA once it is required' },
      { key: 'log_level', type: 'select', choices: ['info', 'warning', 'critical'], label: 'Log level', help: 'Minimum level of system log entries', required: true },
      { key: 'log_retention_days', type: 'number', min: 1, max: 3650, label: 'Log retention (days)', help: 'Days to keep system log entries', required: true },
      { key: 'api_debug_log', type: 'select', choices: ['off', 'on'], default: 'off', label: 'API debug log', help: 'on: log every REST API request with its JSON body (level debug, secrets masked). Turn it off when done', required: true },
    ],
  },
  {
    id: 'backup', section: 'Application', label: 'Backup', icon: 'bi-database',
    fields: [
      { key: 'backup_enabled', type: 'select', choices: ['on', 'off'], label: 'Scheduled backup', help: 'on: back up the database automatically', required: true },
      { key: 'backup_frequency', type: 'select', choices: ['daily', 'weekly', 'monthly'], label: 'Backup frequency', help: 'Weekly runs on Sunday, monthly on the 1st', required: true },
      { key: 'backup_hour', type: 'number', min: 0, max: 23, label: 'Backup hour (0-23)', help: 'Server time', required: true },
      { key: 'backup_retention', type: 'number', min: 1, max: 365, label: 'Scheduled backups to keep', help: 'Older scheduled backups are deleted; manual and uploaded ones are kept', required: true },
    ],
  },
  {
    id: 'system', section: 'Assets', label: 'System', icon: 'bi-list-ul',
    fields: [
      { key: 'system_level', type: 'options', usedBy: [{ table: 'systems', column: 'level', label: 'Systems' }], label: 'System levels' },
      { key: 'system_user_scope', type: 'options', usedBy: [{ table: 'systems', column: 'scopes', multi: true, label: 'Systems' }], label: 'User scopes' },
      { key: 'system_arch', type: 'options', usedBy: [{ table: 'systems', column: 'architecture', multi: true, label: 'Systems' }], label: 'Architectures' },
      { key: 'system_app_type', type: 'options', usedBy: [{ table: 'system_components', column: 'app_type', label: 'Components' }], label: 'Component app types' },
    ],
  },
  {
    id: 'server-device', section: 'Assets', label: 'Server & Device', icon: 'bi-hdd-stack',
    fields: [
      { key: 'server_type', type: 'options', usedBy: [{ table: 'servers', column: 'type', label: 'Servers' }], label: 'Server types' },
      { key: 'server_status', type: 'options', usedBy: [{ table: 'servers', column: 'status', label: 'Servers' }], label: 'Server statuses' },
      { key: 'device_status', type: 'options', label: 'Device statuses' },
      { key: 'device_location', type: 'options', usedBy: [{ table: 'servers', column: 'location', label: 'Servers' }, { table: 'devices', column: 'location', label: 'Devices' }], label: 'Locations', help: 'Used by servers and devices' },
    ],
  },
  {
    id: 'network', section: 'Assets', label: 'Network', icon: 'bi-diagram-3',
    fields: [
      { key: 'ip_address_type', type: 'options', label: 'IP address types' },
      { key: 'ip_address_status', type: 'options', usedBy: [{ table: 'ip_addresses', column: 'status', label: 'IP addresses' }], label: 'IP address statuses' },
      { key: 'network_domain_record_type', type: 'options', usedBy: [{ table: 'domains', column: 'record_type', label: 'Domains' }], label: 'DNS record types' },
      { key: 'service_mapping_partner', type: 'options', usedBy: [{ table: 'virtual_server_partner_ips', column: 'partner', label: 'Service Mappings' }], label: 'Service mapping partners', help: 'Partners of the service mappings (banks, payment gateways...), named on their partner IPs; empty = any name' },
      { key: 'service_mapping_provider', type: 'options', usedBy: [{ table: 'virtual_servers', column: 'provider', label: 'Service Mappings' }], label: 'Service mapping providers / channels', help: 'CDN / WAF (Akamai, Cloudflare) or private channel (VPN, MPLS) in front of a service mapping' },
    ],
  },
  {
    id: 'firewall', section: 'Security', label: 'Firewall', icon: 'bi-bricks',
    fields: [
      { key: 'firewall_name', type: 'options', usedBy: [{ table: 'rulefirewall', column: 'firewall_name', label: 'Firewall rules' }], label: 'Firewall names' },
      { key: 'firewall_rule_action', type: 'options', usedBy: [{ table: 'rulefirewall', column: 'action', label: 'Firewall rules' }], label: 'Rule actions' },
      { key: 'firewall_rule_status', type: 'options', usedBy: [{ table: 'rulefirewall', column: 'status', label: 'Firewall rules' }], label: 'Rule statuses' },
      { key: 'firewall_rule_violation_type', type: 'options', usedBy: [{ table: 'rulefirewall', column: 'violation_type', label: 'Firewall rules' }], label: 'Violation types' },
    ],
  },
  {
    id: 'priv-account', section: 'Security', label: 'Privileged Accounts', icon: 'bi-key',
    fields: [
      { key: 'priv_account_type', type: 'options', usedBy: [{ table: 'priv_users', column: 'account_type', label: 'Privileged accounts' }], label: 'Account types' },
      { key: 'priv_account_manage_type', type: 'options', usedBy: [{ table: 'priv_users', column: 'manage_type', label: 'Privileged accounts' }], label: 'Management methods' },
      { key: 'priv_scope_enforced', type: 'select', choices: ['off', 'on'], default: 'off', required: true, label: "Limit to the user's units",
        help: "on: users without the \"no unit limit\" permission only see privileged accounts, roles and permissions of the systems whose L2 or L3 department is their unit, and only when they manage the privileged accounts of their unit (User Management). Set the units first" },
    ],
  },
  {
    id: 'organization', section: 'Assets', label: 'Organization', icon: 'bi-people',
    fields: [
      { key: 'contact_position', type: 'options', usedBy: [{ table: 'contacts', column: 'position', label: 'Contacts' }], label: 'Contact positions' },
    ],
  },
  {
    id: 'pentest', section: 'Security', label: 'Pentest', icon: 'bi-bug',
    fields: [
      { key: 'pentest_status', type: 'options', usedBy: [{ table: 'pentest_rounds', column: 'status', label: 'Pentest rounds' }], label: 'Pentest statuses' },
    ],
  },
];


const FIELDS = new Map(CONFIG_GROUPS.flatMap(g => g.fields.map(f => [f.key, f])));

export function findGroup(id) {
  return CONFIG_GROUPS.find(g => g.id === id) || null;
}

export function fieldFor(key) {
  return FIELDS.get(key) || null;
}

// Stored text -> [{value, label, active?: false}]. Also reads the older shapes still found
// in databases created before migration 0004 ({levels: [...]}, {key}, plain
// strings, comma-separated text).
export function parseOptions(text) {
  if (text === null || text === undefined || String(text).trim() === '') return [];
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = String(text).split(','); }
  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
    parsed = Object.values(parsed).find(Array.isArray) || [];
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed
    .map(item => {
      if (item !== null && typeof item === 'object') {
        const value = String(item.value ?? item.key ?? '').trim();
        const option = { value, label: String(item.label ?? value).trim() || value };
        if (item.active === false) option.active = false;
        return option;
      }
      const value = String(item ?? '').trim();
      return { value, label: value };
    })
    .filter(o => o.value);
}

// Validates one submitted value; returns { value } (text to store, or null to
// leave the key unset) or { error } (English i18n key + params).
export const LIMITS = {
  textLength: 255,
  intListItems: 10,
  intListMax: 1000,
  options: 200,
  optionValueLength: 100,
  optionLabelLength: 255,
};
// Option values end up in records, URLs and comma-separated filters.
export const OPTION_VALUE_PATTERN = /^[^,<>"'`\\\p{Cc}]+$/u;
const CONTROL_CHARS = /\p{Cc}/u;

// `storedValues` (options only): values already saved for this key. They
// cannot be edited in the grid, so they pass even if older data breaks the
// value rules; only new values must follow them.
export function validateField(field, raw, storedValues = new Set()) {
  const str = raw === undefined || raw === null ? '' : String(raw).trim();
  switch (field.type) {
    case 'text':
      if (!str) return field.required ? { error: '{field} is required', params: {} } : { value: null };
      if (str.length > LIMITS.textLength) return { error: '{field} is too long (max 255 characters)', params: {} };
      if (CONTROL_CHARS.test(str)) return { error: '{field} has an invalid value', params: {} };
      return { value: str };
    case 'number': {
      if (!str) return field.required ? { error: '{field} is required', params: {} } : { value: null };
      const min = field.min ?? 0;
      const max = field.max ?? Number.MAX_SAFE_INTEGER;
      if (!/^[0-9]{1,9}$/.test(str) || Number(str) < min || Number(str) > max) {
        return { error: '{field} must be a whole number from {min} to {max}', params: { min, max } };
      }
      return { value: String(Number(str)) };
    }
    case 'select':
      if (!str) return field.required ? { error: '{field} is required', params: {} } : { value: null };
      if (!field.choices.includes(str)) return { error: '{field} has an invalid value', params: {} };
      return { value: str };
    case 'int_list': {
      if (!str) return field.required ? { error: '{field} is required', params: {} } : { value: null };
      const parts = str.split(',').map(s => s.trim()).filter(Boolean);
      if (!parts.length || parts.some(p => !/^[1-9][0-9]{0,3}$/.test(p) || Number(p) > LIMITS.intListMax)) {
        return { error: '{field}: use whole numbers from 1 to {max} separated by commas', params: { max: LIMITS.intListMax } };
      }
      const nums = [...new Set(parts.map(Number))].sort((a, b) => a - b);
      if (nums.length > LIMITS.intListItems) return { error: '{field}: at most {max} values', params: { max: LIMITS.intListItems } };
      return { value: nums.join(',') };
    }
    case 'options': {
      let items;
      try { items = JSON.parse(str || '[]'); } catch { return { error: '{field} has an invalid value', params: {} }; }
      if (!Array.isArray(items)) return { error: '{field} has an invalid value', params: {} };
      if (items.length > LIMITS.options) return { error: '{field}: at most {max} options', params: { max: LIMITS.options } };
      const seen = new Set();
      const out = [];
      for (const item of items) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return { error: '{field} has an invalid value', params: {} };
        const value = String(item.value ?? '').trim();
        const label = String(item.label ?? '').trim() || value;
        if (!value) return { error: '{field}: every row needs a value', params: {} };
        const isNew = !storedValues.has(value);
        if ((isNew && value.length > LIMITS.optionValueLength) || label.length > LIMITS.optionLabelLength) return { error: '{field}: value or label is too long', params: {} };
        if (isNew && !OPTION_VALUE_PATTERN.test(value)) return { error: '{field}: value "{value}" contains a character that is not allowed (, < > " \' ` \\)', params: { value } };
        if (CONTROL_CHARS.test(label)) return { error: '{field} has an invalid value', params: {} };
        if (seen.has(value)) return { error: '{field}: duplicate value "{value}"', params: { value } };
        seen.add(value);
        out.push(item.active === false ? { value, label, active: false } : { value, label });
      }
      return { value: JSON.stringify(out) };
    }
    default:
      return { error: '{field} has an invalid value', params: {} };
  }
}
