import { pool } from '../../config/config.js';

/**
 * Unit Model - handles all database operations for organization units.
 * Follows ES6 class and ORM-style method naming (findAll, findById, findPage, countAll, etc.).
 */
class Unit {
  /**
   * Create a new unit
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.code
   * @param {string} data.description
   * @returns {Promise<Object>} The created unit
   */
  static async create({ name, code, description }) {
    const result = await pool.query(
      `INSERT INTO units (name, code, description) VALUES ($1, $2, $3) RETURNING *`,
      [name, code, description]
    );
    return result.rows[0];
  }

  /**
   * Get all units (no filter, ordered by id)
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const result = await pool.query('SELECT * FROM units ORDER BY id');
    return result.rows;
  }

  /**
   * Get a unit by id
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Get a unit by name (case-insensitive, trim)
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM units WHERE lower(trim(name)) = lower(trim($1))',
      [name]
    );
    return result.rows[0];
  }

  /**
   * Update an existing unit
   * @param {number} id
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.code
   * @param {string} data.description
   * @returns {Promise<Object>} The updated unit
   */
  static async update(id, { name, code, description }) {
    const result = await pool.query(
      `UPDATE units SET name=$1, code=$2, description=$3 WHERE id=$4 RETURNING *`,
      [name, code, description, id]
    );
    return result.rows[0];
  }

  /**
   * Delete a unit by id
   * @param {number} id
   * @returns {Promise<void>}
   */
  static async delete(id) {
    await pool.query('DELETE FROM units WHERE id = $1', [id]);
  }

  /**
   * Count all units
   * @returns {Promise<number>}
   */
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM units');
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count units matching search term
   * @param {string} search
   * @returns {Promise<number>}
   */
  static async countSearch(search) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT COUNT(*) FROM units WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get a page of units
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT * FROM units ORDER BY id LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  /**
   * Search units with pagination
   * @param {string} search
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findSearchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT * FROM units WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return result.rows;
  }

  /**
   * Check if a unit exists by id
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM units WHERE id = $1', [id]);
    return result.rowCount > 0;
  }


  /**
   * Search units for select2 (by name, code, or description, limit 20, order by name)
   * @param {string} search
   * @returns {Promise<Array<{id:number, name:string}>>}
   */
  static async unitSearchSelect2(search) {
    let sql = 'SELECT id, name FROM units';
    let params = [];
    if (search) {
      sql += ' WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await pool.query(sql, params);
    return result.rows;
  }

    /**
   * Get multiple units by array of ids
   * @param {Array<number|string>} ids
   * @returns {Promise<Array>}
   */
  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM units WHERE id = ANY($1)', [ids]);
    return result.rows;
  }

}

export default Unit;