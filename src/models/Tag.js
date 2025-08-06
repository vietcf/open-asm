import { pool } from '../../config/config.js';

/**
 * Tag Model - handles all database operations for tags.
 * Follows ES6 class and ORM-style method naming (findAll, findById, findPage, countAll, etc.).
 */
class Tag {
  /**
   * Create a new tag
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.description
   * @returns {Promise<Object>} The created tag
   */
  static async create({ name, description }) {
    const result = await pool.query(
      'INSERT INTO tags (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  }

  /**
   * Get all tags (no filter, ordered by id)
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const result = await pool.query('SELECT * FROM tags ORDER BY id');
    return result.rows;
  }

  /**
   * Get a tag by id
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const result = await pool.query('SELECT * FROM tags WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Get tags by multiple ids
   * @param {Array<number>} ids
   * @returns {Promise<Array>}
   */
  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM tags WHERE id = ANY($1)', [ids]);
    return result.rows;
  }

  /**
   * Update a tag
   * @param {number} id
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.description
   * @returns {Promise<Object>} The updated tag
   */
  static async update(id, { name, description }) {
    const result = await pool.query(
      'UPDATE tags SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    return result.rows[0];
  }

  /**
   * Delete a tag by id
   * @param {number} id
   * @returns {Promise<void>}
   */
  static async delete(id) {
    await pool.query('DELETE FROM tags WHERE id = $1', [id]);
  }

  /**
   * Count all tags (optionally by search)
   * @param {string} [search]
   * @returns {Promise<number>}
   */
  static async countAll(search = '') {
    let sql = 'SELECT COUNT(*) FROM tags';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    const result = await pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get a page of tags (optionally by search)
   * @param {number} page
   * @param {number} pageSize
   * @param {string} [search]
   * @returns {Promise<Array>}
   */
  static async findPage(page = 1, pageSize = 10, search = '') {
    const offset = (page - 1) * pageSize;
    let sql = 'SELECT * FROM tags';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(pageSize, offset);
    const result = await pool.query(sql, params);
    return result.rows;
  }

  /**
   * Search tags (for select2, etc.)
   * @param {string} search
   * @returns {Promise<Array>}
   */
  static async findSearch(search) {
    let sql = 'SELECT * FROM tags';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY id LIMIT 20';
    const result = await pool.query(sql, params);
    return result.rows;
  }

  /**
   * Search tags for select2 (id, name only)
   * @param {string} search
   * @returns {Promise<Array<{id:number, name:string}>>}
   */
  static async findSearchForSelect2(search) {
    let sql = 'SELECT id, name FROM tags';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY id LIMIT 20';
    const result = await pool.query(sql, params);
    return result.rows;
  }

  /**
   * Check if a tag exists by id
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM tags WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Find tags by exact name match (case-insensitive)
   * @param {string} name - Name to search for (exact match)
   * @returns {Promise<Array>}
   */
  static async findByNameExact(name) {
    const result = await pool.query(
      'SELECT * FROM tags WHERE LOWER(name) = LOWER($1) ORDER BY id',
      [name]
    );
    return result.rows;
  }
}

export default Tag;
