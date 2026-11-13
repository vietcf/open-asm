import { pool } from '../../../config/config.js';
import { Where, NONE, searchRank } from '../../shared/db.js';
import { unitSubtree } from './unit.model.js';

function filterWhere({ search = '', unit_id = '', position = '' }) {
  const w = new Where().search(search, ['c.name ILIKE ?', 'c.email ILIKE ?', 'c.phone ILIKE ?', 'c.position ILIKE ?', 'c.description ILIKE ?', 'u.name ILIKE ?']);
  if (unit_id === NONE) w.add('c.unit_id IS NULL');
  else if (unit_id) w.add(`c.unit_id IN ${unitSubtree(w.param(Number(unit_id)))}`); // the unit and its sub-units
  if (position) w.add(`c.position = ${w.param(position)}`);
  return w;
}

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
  static async create({ name, email, phone, position, unit_id, description }, client = pool) {
    const result = await client.query(
      `INSERT INTO contacts (name, email, phone, position, unit_id, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, phone, position, unit_id || null, description || null]
    );
    return result.rows[0];
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
   * Get a contact by name (case-insensitive)
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE lower(name) = lower($1)',
      [name]
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
      `UPDATE contacts SET name=$1, email=$2, phone=$3, position=$4, unit_id=$5, description=$6, updated_at=CURRENT_TIMESTAMP
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

  // Every contact of the given units (unit detail / export), by name
  // Contacts of each unit and of all its sub-units (any depth), with the unit they
  // belong to: [{root_id, id, name, email, phone, position, unit_id, unit_name}]
  static async findInUnitTrees(unitIds) {
    if (!unitIds.length) return [];
    const result = await pool.query(
      `SELECT r.id AS root_id, c.id, c.name, c.email, c.phone, c.position, c.unit_id, cu.name AS unit_name
         FROM units r
         JOIN contacts c ON c.unit_id IN ${unitSubtree('r.id')}
         JOIN units cu ON cu.id = c.unit_id
        WHERE r.id = ANY($1::int[])
        ORDER BY r.id, (c.unit_id <> r.id), cu.name, c.name, c.id`, [unitIds]);
    return result.rows;
  }

  static async findByUnitIds(unitIds) {
    if (!unitIds.length) return [];
    const result = await pool.query(
      'SELECT id, name, email, phone, position, unit_id FROM contacts WHERE unit_id = ANY($1::int[]) ORDER BY name, id', [unitIds]);
    return result.rows;
  }

  // Page of contacts with their unit name; filter: {search, unit_id, position}
  static async findFilteredPage(filter) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name FROM contacts c LEFT JOIN units u ON c.unit_id = u.id
       WHERE ${w} ORDER BY ${searchRank(['c.name', 'c.email'], filter.search, w)}c.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM contacts c LEFT JOIN units u ON c.unit_id = u.id WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2 lookup: [{id, text}], text = "Name (mailbox)"
  static async select2Search(search = '') {
    const w = new Where().search(search, ['c.name ILIKE ?', 'c.email ILIKE ?']);
    const result = await pool.query(
      `SELECT c.id, c.name || COALESCE(' (' || NULLIF(split_part(c.email, '@', 1), '') || ')', '') AS text
       FROM contacts c WHERE ${w} ORDER BY ${searchRank(['c.name', 'c.email'], search, w)}c.name LIMIT 20`,
      w.params
    );
    return result.rows;
  }

  /**
   * Find contacts by email (supports both full email and email prefix before @)
   * @param {string} email - Full email or email prefix (part before @)
   * @returns {Promise<Array>} Array of matching contacts
   */
  static async findByEmailSearch(email) {
    let sql, params;
    
    if (email.includes('@')) {
      // Full email search - exact match
      sql = `SELECT c.*, u.name AS unit_name
             FROM contacts c
             LEFT JOIN units u ON c.unit_id = u.id
             WHERE LOWER(c.email) = LOWER($1)
             ORDER BY c.id`;
      params = [email];
    } else {
      // Email prefix search - match the part before @
      sql = `SELECT c.*, u.name AS unit_name
             FROM contacts c
             LEFT JOIN units u ON c.unit_id = u.id
             WHERE LOWER(SPLIT_PART(c.email, '@', 1)) = LOWER($1)
             ORDER BY c.id`;
      params = [email];
    }
    
    const result = await pool.query(sql, params);
    return result.rows;
  }

}

export default Contact;