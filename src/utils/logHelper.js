const SystemLog = require('../models/SystemLog');
const os = require('os');

/**
 * Ghi log hệ thống, tự động lấy các trường user, ip, user_agent nếu có trong req
 * @param {Object} options
 * @param {string} options.action - Hành động (login, logout, ...)
 * @param {string} [options.description] - Thông tin chi tiết
 * @param {Object} [options.req] - Request object (nếu có)
 * @param {string} [options.status] - Trạng thái (success, failed, ...)
 * @param {string} [options.object_type] - Loại đối tượng liên quan
 * @param {string|number} [options.object_id] - ID đối tượng liên quan
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

module.exports = { writeLog };
