import SystemLog, { LOG_LEVELS } from '../modules/administrator/system-log.model.js';
import Configuration from '../modules/administrator/configuration.model.js';
import os from 'os';

// Security audit events. Explicit actions (login/logout/2FA, see
// authController) and every change made through these paths (users, roles,
// permissions, system configuration, own password, 2FA setup). Same lists
// as migrations/versions/0008_system_log_category_level.js.
export const SECURITY_ACTIONS = new Set(['login', 'logout', '2fa', 'change_password']);
export const SECURITY_PATH_PREFIXES = ['/administrator', '/change-password', '/2fa'];

// Log settings, read on every write: cached for 30 seconds, so a change made on
// the configuration page takes effect within that time.
const settingsCache = new Map();
async function setting(key, isValid, fallback) {
  const hit = settingsCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.value;
  let value = fallback;
  try {
    const row = await Configuration.findById(key);
    if (row && isValid(row.value)) value = row.value;
  } catch { /* keep default */ }
  settingsCache.set(key, { value, at: Date.now() });
  return value;
}

// log_level setting: the minimum level kept for the application log.
// Security events are always written; debug entries only follow api_debug_log.
const minAppLevel = () => setting('log_level', (v) => LOG_LEVELS.includes(v) && v !== 'debug', 'info');

// api_debug_log setting: log REST API requests with their JSON body (default off)
export const isApiDebugLogOn = async () => (await setting('api_debug_log', (v) => v === 'on' || v === 'off', 'off')) === 'on';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0].trim() : null) || req.ip || req.socket?.remoteAddress || null;
}

/**
 * Write a system log entry; user, ip and user_agent are taken from req when present
 * @param {Object} options
 * @param {string} options.action - Action (login, logout, create, update, delete, ...)
 * @param {string} [options.description] - Details
 * @param {Object} [options.req] - Request object (optional)
 * @param {string} [options.status] - Status (success, failed, ...)
 * @param {string} [options.object_type] - Related object type
 * @param {string|number} [options.object_id] - Related object ID
 * @param {'app'|'security'} [options.category] - Defaults to 'security' for SECURITY_ACTIONS, else 'app'
 * @param {'debug'|'info'|'warning'|'critical'} [options.level] - Defaults to 'warning' when status is failed, else 'info'.
 *   debug is not filtered by log_level: its caller checks isApiDebugLogOn()
 */
async function writeLog({ action, description, req, status, object_type, object_id, username, user_id, category, level }) {
  const cat = category || (SECURITY_ACTIONS.has(action) ? 'security' : 'app');
  const lvl = level || (status === 'failed' ? 'warning' : 'info');
  if (cat === 'app' && lvl !== 'debug' && LOG_LEVELS.indexOf(lvl) < LOG_LEVELS.indexOf(await minAppLevel())) return;

  const log = {
    action,
    description: description || '',
    object_type: object_type || null,
    object_id: object_id || null,
    status: status || null,
    user_id: user_id || null,
    username: username || null,
    ip_address: null,
    user_agent: null,
    category: cat,
    level: lvl,
  };
  if (req) {
    log.ip_address = clientIp(req);
    log.user_agent = req.headers['user-agent'] || null;
    const user = (req.session && req.session.user) || req.user;
    if (user) {
      if (!log.username) log.username = user.username;
      if (!log.user_id) log.user_id = user.id;
    }
  }
  if (!log.username) log.username = os.userInfo().username || null;
  await SystemLog.create(log);
}

export { writeLog };
