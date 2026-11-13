// Fields that must be unique, checked by the Add / Edit forms when the field is
// left (GET /api/unique-check, form-kit.js `data-unique`), with the same rule
// the service applies on save, so the form says "already used" before submit.
// The save still checks: this is only an early warning.
//
//   compare  'ci'       case-insensitive (LOWER = LOWER)
//            'ci-trim'  case-insensitive, surrounding spaces ignored
//            'exact'    as typed
//            'inet'     same network address (subnets)
//   scope    other columns that must match too, given by the form as
//            scope[<column>]=value (component name within its system...);
//            no check until every scope value is filled
//   label    column shown for the record already holding the value
//   url      its edit page (:id)
//   permission  needed to ask (the read permission of the entity)
// Table / column names come from this file only, never from the request.
import { pool } from '../../config/config.js';

const ci = (table, column, url, permission, extra = {}) => ({ table, column, compare: 'ci', url, permission, label: column, ...extra });

export const UNIQUE_CHECKS = {
  'server.name': ci('servers', 'name', '/server/server/:id/edit', 'server.read'),
  'device.name': ci('devices', 'name', '/device/device/:id/edit', 'device.read'),
  'cluster.name': ci('clusters', 'name', '/cluster/:id/edit', 'cluster.read'),
  'customer.name': { table: 'customers', column: 'name', compare: 'ci-trim', label: 'name', url: '/customer/:id/edit', permission: 'customer.read' },
  'customer.code': ci('customers', 'code', '/customer/:id/edit', 'customer.read', { label: 'name' }),
  'service_mapping.name': ci('virtual_servers', 'name', '/network/service-mapping/:id/edit', 'service_mapping.read'),
  'system.name': ci('systems', 'name', '/system/system/:id/edit', 'system.read'),
  'system.system_id': { table: 'systems', column: 'system_id', compare: 'exact', label: 'name', url: '/system/system/:id/edit', permission: 'system.read' },
  'component.name': ci('system_components', 'name', '/system/component/:id/edit', 'system.read', { scope: ['system_id'] }),
  'contact.email': ci('contacts', 'email', '/organize/contact/:id/edit', 'contact.read', { label: 'name' }),
  'unit.name': { table: 'units', column: 'name', compare: 'ci-trim', label: 'name', url: '/organize/unit/:id/edit', permission: 'unit.read' },
  'tag.name': ci('tags', 'name', '/organize/tag/:id/edit', 'tag.read'),
  'domain.domain': { table: 'domains', column: 'domain', compare: 'exact', label: 'domain', url: '/network/domain/:id/edit', permission: 'domain.read' },
  'subnet.address': { table: 'subnets', column: 'address', compare: 'inet', label: 'address', url: '/network/subnet-address/:id/edit', permission: 'subnet.read' },
  'priv_account.username': ci('priv_users', 'username', '/priv-account/account/:id/edit', 'priv_account.read'),
  'priv_role.name': ci('priv_roles', 'name', '/priv-account/role/:id/edit', 'priv_role.read', { scope: ['system_id'] }),
  'priv_permission.name': { table: 'priv_permissions', column: 'name', compare: 'exact', label: 'name', url: '/priv-account/permission/:id/edit', permission: 'priv_permission.read', scope: ['system_id'] },
  'user.username': ci('users', 'username', '/administrator/users/:id/edit', 'user.read'),
  'user.email': ci('users', 'email', '/administrator/users/:id/edit', 'user.read', { label: 'username' }),
  'role.name': ci('roles', 'name', '/administrator/roles/:id/edit', 'role.read'),
  'permission.name': { table: 'permissions', column: 'name', compare: 'exact', label: 'name', url: '/administrator/permissions/:id/edit', permission: 'permission.read' },
  'device_type.name': ci('device_types', 'name', '/device/type/:id/edit', 'device_type.read'),
  'platform.name': ci('platforms', 'name', '/device/platform/:id/edit', 'platform.read'),
  'service.name': ci('services', 'name', '/server/service/:id/edit', 'service.read'),
  'agent.name': ci('agents', 'name', '/server/agent/:id/edit', 'agent.read'),
  'rule.rulename': { table: 'rulefirewall', column: 'rulename', compare: 'exact', label: 'rulename', url: '/firewall/rule/:id/edit', permission: 'rule.read', scope: ['firewall_name', 'audit_batch'] },
};

const CIDR = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

// -> { state: 'ok' | 'taken' | 'invalid' | 'incomplete', existing?: {id, label, url} }
export async function checkUnique(key, value, { excludeId = null, scope = {} } = {}) {
  const check = UNIQUE_CHECKS[key];
  const v = String(value ?? '').trim();
  if (!check || !v) return { state: 'ok' };
  if (check.compare === 'inet' && !CIDR.test(v)) return { state: 'invalid' };
  const params = [];
  const p = (x) => { params.push(x); return `$${params.length}`; };
  const COMPARE = {
    ci: (x) => `LOWER(${check.column}) = LOWER(${x})`,
    'ci-trim': (x) => `LOWER(TRIM(${check.column})) = LOWER(TRIM(${x}))`,
    exact: (x) => `${check.column} = ${x}`,
    inet: (x) => `${check.column} = ${x}::inet`,
  };
  const where = [COMPARE[check.compare](`${p(v)}::text`)];
  for (const column of check.scope || []) {
    const s = String(scope[column] ?? '').trim();
    if (!s) return { state: 'incomplete' };
    where.push(`${column}::text = ${p(s)}`);
  }
  const id = Number(excludeId);
  if (Number.isInteger(id) && id > 0) where.push(`id <> ${p(id)}`);
  try {
    const { rows: [row] } = await pool.query(
      `SELECT id, ${check.label}::text AS label FROM ${check.table} WHERE ${where.join(' AND ')} ORDER BY id LIMIT 1`, params);
    return row ? { state: 'taken', existing: { id: row.id, label: row.label, url: check.url.replace(':id', row.id) } } : { state: 'ok' };
  } catch (err) {
    if (err.code === '22P02') return { state: 'invalid' }; // not a valid inet / number
    throw err;
  }
}
