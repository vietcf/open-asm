
/**
 * User model for PostgreSQL (ES6 class)
 * Author: [Your Name]
 * Created: 2025-07-04
 * Description: Handles all user-related database operations: CRUD, pagination, 2FA, password management.
 */

import { pool } from '../../config/config.js';

/**
 * User model - ES6 export for better IDE support
 *
 * This class provides static methods for interacting with the users table in PostgreSQL.
 * All methods are asynchronous and return Promises.
 *
 * Main responsibilities:
 *   - User CRUD operations (create, read, update, delete)
 *   - Pagination and user listing
 *   - 2FA (two-factor authentication) management
 *   - Password management and security flags
 *
 * Usage:
 *   import User from './User.js';
 *   const user = await User.findByUsername('admin');
 */
class User {
  /**
   * Find a user by username, including role name
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(username) {
    const sql = `SELECT users.*, roles.name AS role_name FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE users.username = $1 LIMIT 1`;
    const result = await pool.query(sql, [username]);
    return result.rows[0];
  }

  /**
   * Get all users
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const sql = 'SELECT * FROM users ORDER BY id';
    const result = await pool.query(sql);
    return result.rows;
  }

  /**
   * Create a new user
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  static async create({ username, email, fullname, role, passwordHash, require_twofa, must_change_password }) {
    const sql = 'INSERT INTO users (username, email, fullname, role_id, password_hash, require_twofa, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *';
    const result = await pool.query(sql, [username, email, fullname, role, passwordHash, require_twofa, must_change_password !== undefined ? must_change_password : true]);
    return result.rows[0];
  }

  /**
   * Update a user by id
   * @param {number} id
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  static async update(id, { username, email, fullname, role, require_twofa, must_change_password, passwordHash }) {
    let sql, params;
    if (passwordHash) {
      sql = 'UPDATE users SET username = $1, email = $2, fullname = $3, role_id = $4, require_twofa = $5, must_change_password = $6, password_hash = $7 WHERE id = $8 RETURNING *';
      params = [username, email, fullname, role, require_twofa, must_change_password, passwordHash, id];
    } else {
      sql = 'UPDATE users SET username = $1, email = $2, fullname = $3, role_id = $4, require_twofa = $5, must_change_password = $6 WHERE id = $7 RETURNING *';
      params = [username, email, fullname, role, require_twofa, must_change_password, id];
    }
    const result = await pool.query(sql, params);
    return result.rows[0];
  }

  /**
   * Delete a user by id
   * @param {number} id
   * @returns {Promise<void>}
   */
  static async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  /**
   * Count all users
   * @returns {Promise<number>}
   */
  static async countAll() {
    const sql = 'SELECT COUNT(*) FROM users';
    const result = await pool.query(sql);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get a page of users with roles
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const sql = `SELECT users.*, roles.name AS role_name FROM users LEFT JOIN roles ON users.role_id = roles.id ORDER BY users.id LIMIT $1 OFFSET $2`;
    const result = await pool.query(sql, [pageSize, offset]);
    return result.rows;
  }

  /**
   * Find a user by id
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = $1 LIMIT 1';
    const result = await pool.query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Update 2FA secret and enabled status
   * @param {number} id
   * @param {string} secret
   * @param {boolean} enabled
   * @returns {Promise<void>}
   */
  static async updateTwoFA(id, secret, enabled) {
    const sql = 'UPDATE users SET twofa_secret = $1, twofa_enabled = $2 WHERE id = $3';
    await pool.query(sql, [secret, enabled, id]);
  }

  /**
   * Update 2FA setup deadline
   * @param {number} id
   * @param {string} deadline
   * @returns {Promise<void>}
   */
  static async updateTwofaDeadline(id, deadline) {
    const sql = 'UPDATE users SET twofa_setup_deadline = $1 WHERE id = $2';
    await pool.query(sql, [deadline, id]);
  }

  /**
   * Update user password
   * @param {number} id
   * @param {string} newHash
   * @returns {Promise<void>}
   */
  static async updatePassword(id, newHash) {
    const sql = 'UPDATE users SET password_hash = $1 WHERE id = $2';
    await pool.query(sql, [newHash, id]);
  }

  /**
   * Update must_change_password flag
   * @param {number} id
   * @param {boolean} value
   * @returns {Promise<void>}
   */
  static async updateMustChangePassword(id, value) {
    const sql = 'UPDATE users SET must_change_password = $1 WHERE id = $2';
    await pool.query(sql, [value, id]);
  }
}

export default User;
