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

  /**
   * Build the shared WHERE clause/params for search + unit/position filters,
   * so the page query and its count always agree on what matches.
   * @private
   */
  static _buildFilterConditions({ search, unit_id, position }) {
    const conditions = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.position ILIKE $${idx} OR c.description ILIKE $${idx} OR u.name ILIKE $${idx})`);
    }
    if (unit_id) {
      params.push(unit_id);
      conditions.push(`c.unit_id = $${params.length}`);
    }
    if (position) {
      params.push(position);
      conditions.push(`c.position = $${params.length}`);
    }
    return {
      whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Get paginated contacts, optionally searched and/or filtered by
   * unit_id/position (all optional, combine with AND).
   * @returns {Promise<Array>}
   */
  static async findFilteredPage({ search, unit_id, position, page, pageSize }) {
    const offset = (page - 1) * pageSize;
    const { whereSql, params } = Contact._buildFilterConditions({ search, unit_id, position });
    params.push(pageSize, offset);
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       ${whereSql}
       ORDER BY c.id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  /**
   * Count contacts matching the same search/filter combination as
   * findFilteredPage.
   * @returns {Promise<number>}
   */
  static async countFiltered({ search, unit_id, position }) {
    const { whereSql, params } = Contact._buildFilterConditions({ search, unit_id, position });
    const result = await pool.query(
      `SELECT COUNT(*) FROM contacts c LEFT JOIN units u ON c.unit_id = u.id ${whereSql}`,
      params
    );
    return parseInt(result.rows[0].count, 10);
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