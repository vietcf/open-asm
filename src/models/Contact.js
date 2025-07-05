import { pool } from '../../config/config.js';

/**
 * Contact Model - handles all database operations for contacts and their relationships.
 *
 * Naming convention: All methods use get/set prefix for clarity and consistency.
 * - get...: Fetch data (single/multiple records, filtered, paginated, etc.)
 * - set...: Update or assign relationships (if any in future)
 *
 * All business logic for Contact CRUD is encapsulated here.
 */
class Contact {
  /**
   * Create a new contact
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.email
   * @param {string} data.phone
   * @param {string} data.position
   * @param {number} data.unit_id
   * @param {string} data.description
   * @returns {Promise<Object>} The created contact
   */
  static async create({ name, email, phone, position, unit_id, description }) {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, phone, position, unit_id, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, phone, position, unit_id || null, description || null]
    );
    return result.rows[0];
  }

  /**
   * Get all contacts (no filter, ordered by id)
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const result = await pool.query('SELECT * FROM contacts ORDER BY id');
    return result.rows;
  }

  /**
   * Get a contact by id
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get a contact by email (case-insensitive)
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE lower(email) = lower($1)',
      [email]
    );
    return result.rows[0];
  }

  /**
   * Update a contact
   * @param {number} id
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.email
   * @param {string} data.phone
   * @param {string} data.position
   * @param {number} data.unit_id
   * @param {string} data.description
   * @returns {Promise<Object>} The updated contact
   */
  static async update(id, { name, email, phone, position, unit_id, description }) {
    const result = await pool.query(
      `UPDATE contacts SET name=$1, email=$2, phone=$3, position=$4, unit_id=$5, description=$6
       WHERE id=$7 RETURNING *`,
      [name, email, phone, position, unit_id || null, description || null, id]
    );
    return result.rows[0];
  }

  /**
   * Delete a contact by id
   * @param {number} id
   * @returns {Promise<void>}
   */
  static async delete(id) {
    await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
  }

  /**
   * Count all contacts
   * @returns {Promise<number>}
   */
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM contacts');
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get paginated list of contacts
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       ORDER BY c.id
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  /**
   * Get paginated list of contacts by search
   * @param {string} search
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findSearchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE c.name ILIKE $1 OR c.email ILIKE $2 OR c.phone ILIKE $1 OR c.position ILIKE $1 OR c.description ILIKE $1 OR u.name ILIKE $1
       ORDER BY c.id
       LIMIT $3 OFFSET $4`,
      [q, search.includes('@') ? search : q, pageSize, offset]
    );
    return result.rows;
  }

  /**
   * Count contacts by search
   * @param {string} search
   * @returns {Promise<number>}
   */
  static async countSearch(search) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT COUNT(*) FROM contacts
       WHERE name ILIKE $1 OR email ILIKE $2 OR phone ILIKE $1 OR position ILIKE $1 OR description ILIKE $1`,
      [q, search.includes('@') ? search : q]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get contacts by array of ids
   * @param {Array<number>} ids
   * @returns {Promise<Array>}
   */
  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE c.id = ANY($1::int[])`,
      [ids]
    );
    return result.rows;
  }

  /**
   * Check if a contact exists by id
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM contacts WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

   /**
   * Search contacts for select2 (by name or email, limit 20, order by name)
   * @param {string} search
   * @returns {Promise<Array<{id:number, name:string, email:string}>>}
   */
  static async contactSearchSelect2(search) {
    let sql = 'SELECT id, name, email FROM contacts';
    let params = [];
    if (search) {
      sql += ' WHERE name ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await pool.query(sql, params);
    return result.rows;
  }

}

export default Contact;