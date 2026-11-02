// Audit log for every data change made through the web UI or the REST API.
//
// Each POST/PUT/PATCH/DELETE request by a signed-in user is written to
// system_log once the response is sent: who, when, from where, what action
// on which object, and whether it worked. The request body is never logged
// (passwords, secrets, personal data). Category: 'security' under
// SECURITY_PATH_PREFIXES (users, roles, permissions, configuration, own
// password, 2FA), otherwise 'app' (subject to the log_level setting).
//
// Result: failed when the status is >= 400, or when the handler queued an
// error flash message before redirecting (the usual pattern of the web
// controllers); level warning for failures, critical for 5xx.
import { writeLog, SECURITY_PATH_PREFIXES } from '../utils/logHelper.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Logged explicitly elsewhere (auth) or not a data change.
const SKIP_PATHS = [/^\/login(\/|$)/, /^\/logout$/, /^\/api\/upload/, /^\/i18n\//, /^\/api\/v1\/auth\//, /validate/];

const VERBS = {
  add: 'create', create: 'create', new: 'create',
  edit: 'update', update: 'update',
  delete: 'delete', remove: 'delete', 'delete-multiple': 'delete', 'bulk-delete': 'delete',
  import: 'import', export: 'export',
};
const PLURALS = { users: 'user', roles: 'role', permissions: 'permission', systems: 'system', servers: 'server', devices: 'device', contacts: 'contact', units: 'unit', tags: 'tag', components: 'component' };
const isId = s => /^\d+$/.test(s) || /^[0-9a-f-]{32,36}$/i.test(s);

// "/system/system/5/edit" -> { action: 'update', object_type: 'system', object_id: '5' }
export function describeRequest(method, path) {
  if (path === '/change-password') return { action: 'change_password', object_type: 'user', object_id: null };
  const segments = path.split('/').filter(Boolean).map(s => decodeURIComponent(s));
  const parts = segments[0] === 'api' && segments[1] === 'v1' ? segments.slice(2) : segments;
  let action = null;
  let objectId = null;
  const nouns = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].toLowerCase();
    if (isId(seg)) { objectId = parts[i]; continue; }
    if (VERBS[seg]) { action = VERBS[seg]; continue; }
    if (seg === 'configuration' && parts[i + 1]) { nouns.push('configuration'); objectId = parts[i + 1]; i++; continue; }
    nouns.push(seg);
  }
  if (!action) action = method === 'DELETE' ? 'delete' : (method === 'PUT' || method === 'PATCH') ? 'update' : 'create';
  // last noun is the object ("/network/ip-address/import" -> ip-address); a
  // trailing sub-action ("/2fa/disable") becomes part of the action
  let objectType = nouns.length ? nouns[nouns.length - 1] : null;
  if (nouns.length >= 2 && !objectId && !VERBS[objectType] && /^(disable|enable|setup|verify|reset|toggle|restore|run)$/.test(objectType)) {
    action = objectType;
    objectType = nouns[nouns.length - 2];
  }
  if (objectType && PLURALS[objectType]) objectType = PLURALS[objectType];
  return { action, object_type: objectType, object_id: objectId };
}

function flashMessage(req, type) {
  const list = req.session && req.session.flash && req.session.flash[type];
  return Array.isArray(list) && list.length ? String(list[list.length - 1]) : null;
}

export default function auditLog(req, res, next) {
  if (!MUTATING.has(req.method)) return next();
  const path = req.path;
  if (SKIP_PATHS.some(re => re.test(path))) return next();

  res.on('finish', () => {
    const user = (req.session && req.session.user) || req.user;
    if (!user) return; // not signed in: the request was refused before doing anything
    const { action, object_type, object_id } = describeRequest(req.method, path);
    const flashError = flashMessage(req, 'error');
    const failed = res.statusCode >= 400 || Boolean(flashError);
    const message = flashError || flashMessage(req, 'success');
    writeLog({
      req,
      action,
      object_type,
      object_id,
      status: failed ? 'failed' : 'success',
      level: res.statusCode >= 500 ? 'critical' : (failed ? 'warning' : 'info'),
      category: SECURITY_PATH_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ? 'security' : 'app',
      description: `${req.method} ${path} (${res.statusCode})${message ? ' - ' + message.slice(0, 300) : ''}`,
    }).catch(err => console.error('[audit] could not write log:', err.message));
  });
  next();
}
