// Which privileged data a signed-in user may see and change.
//
// While the setting priv_scope_enforced is on, a user without the permission
// priv_account.all_scope (superadmin has every permission) only works on the
// systems of their unit: systems whose L2 (ops_department_id) or L3
// (department_id) is the user's unit (users.unit_id), and only when they
// manage the privileged accounts of their unit (users.priv_unit_admin).
//   accounts   seen when one of their systems is managed, changed only when
//              all of them are
//   roles / permissions   of a managed system; "all systems" ones are seen
//              by everyone, changed only with priv_role.global
//
// scope = null (no limit) or { userId }; the SQL helpers take a placeholder
// ($n) holding userId.
import { pool } from '../../../config/config.js';
import Configuration from '../administrator/configuration.model.js';

export const userUnitsSql = (p) => `SELECT unit_id FROM users WHERE id = ${p} AND unit_id IS NOT NULL AND priv_unit_admin`;

export const managedSystemsSql = (p) =>
  `SELECT s.id FROM systems s WHERE s.ops_department_id IN (${userUnitsSql(p)}) OR s.department_id IN (${userUnitsSql(p)})`;

export async function privScope(req, res) {
  if (res.locals.hasPermission('priv_account.all_scope')) return null;
  const setting = await Configuration.findByKey('priv_scope_enforced');
  if ((setting?.value || 'off') !== 'on') return null;
  return { userId: Number(req.session.user?.id) || 0 };
}

// Ids of the systems the scope may work on (null: every system)
export async function managedSystemIds(scope) {
  if (!scope) return null;
  const result = await pool.query(managedSystemsSql('$1'), [scope.userId]);
  return result.rows.map((r) => r.id);
}

// Names of the user's units, for the "limited to" note of the list pages
export async function scopeUnitNames(scope) {
  if (!scope) return null;
  const result = await pool.query(`SELECT name FROM units WHERE id IN (${userUnitsSql('$1')}) ORDER BY name`, [scope.userId]);
  return result.rows.map((r) => r.name);
}

// Everything a priv page needs: scope, may manage "all systems" roles / permissions, note for the list
export async function privAccess(req, res) {
  const scope = await privScope(req, res);
  return { scope, canGlobal: res.locals.hasPermission('priv_role.global'), scopeUnits: await scopeUnitNames(scope) };
}
