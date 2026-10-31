
import SystemLog from '../models/SystemLog.js';
import os from 'os';

/**
 * Write a system log entry; user, ip and user_agent are taken from req when present
 * @param {Object} options
 * @param {string} options.action - Action (login, logout, ...)
 * @param {string} [options.description] - Details
 * @param {Object} [options.req] - Request object (optional)
 * @param {string} [options.status] - Status (success, failed, ...)
 * @param {string} [options.object_type] - Related object type
 * @param {string|number} [options.object_id] - Related object ID
 */
async function writeLog({ action, description, req, status, object_type, object_id, username, user_id }) {
  let log = {
    action,
    description: description || '',
    object_type: object_type || null,
    object_id: object_id || null,
    status: status || null,
    user_id: user_id || null,
    username: username || null,
    ip_address: null,
    user_agent: null
  };
  if (req) {
    log.ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress || null;
    log.user_agent = req.headers['user-agent'] || null;
    if (req.session && req.session.user) {
      if (!log.username) log.username = req.session.user.username;
      if (!log.user_id) log.user_id = req.session.user.id;
    }
  }
  if (!log.username) log.username = os.userInfo().username || null;
  await SystemLog.create(log);
}

export { writeLog };
