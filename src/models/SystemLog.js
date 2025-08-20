import { pool } from '../../config/config.js';

const SystemLog = {
  /**
   * Ghi log hệ thống với đầy đủ trường theo bảng system_log
   * @param {Object} log
   * @param {string} log.action
   * @param {string} [log.object_type]
   * @param {string|number} [log.object_id]
   * @param {string} [log.description]
   * @param {number} [log.user_id]
   * @param {string} [log.username]
   * @param {string} [log.ip_address]
   * @param {string} [log.user_agent]
   * @param {string} [log.status]
   */
  async create(log) {
    await pool.query(
      `INSERT INTO system_log (action, object_type, object_id, description, user_id, username, ip_address, user_agent, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        log.action,
        log.object_type || null,
        log.object_id || null,
        log.description || '',
        log.user_id || null,
        log.username || null,
        log.ip_address || null,
        log.user_agent || null,
        log.status || null
      ]
    );
  }
};

export default SystemLog;
