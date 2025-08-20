import { pool } from '../../config/config.js';

class Platform {
  static async create({ name, description }) {
    // Check for unique name constraint
    const nameExists = await this.checkNameExists(name);
    if (nameExists) {
      throw new Error('Platform name already exists');
    }

    const result = await pool.query(
      `INSERT INTO platforms (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM platforms ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM platforms WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async update(id, updateData) {
    // If updateData is a string (backward compatibility), assume it's description
    if (typeof updateData === 'string') {
      updateData = { description: updateData };
    }

    // Filter out undefined/null values and build dynamic query
    const fieldsToUpdate = Object.entries(updateData)
      .filter(([key, value]) => value !== undefined && value !== null)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Check for unique name constraint if name is being updated
    if (fieldsToUpdate.name) {
      const existing = await this.checkNameExists(fieldsToUpdate.name, id);
      if (existing) {
        throw new Error('Platform name already exists');
      }
    }

    // Build dynamic query
    const setClause = Object.keys(fieldsToUpdate)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');

    const values = Object.values(fieldsToUpdate);
    values.push(id); // Add id as the last parameter

    const result = await pool.query(
      `UPDATE platforms SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async checkNameExists(name, excludeId = null) {
    let query = 'SELECT 1 FROM platforms WHERE LOWER(name) = LOWER($1)';
    let params = [name];

    if (excludeId !== null) {
      query += ' AND id != $2';
      params.push(excludeId);
    }

    const result = await pool.query(query, params);
    return result.rowCount > 0;
  }

  static async remove(id) {
    await pool.query('DELETE FROM platforms WHERE id = $1', [id]);
  }

  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM platforms');
    return parseInt(result.rows[0].count, 10);
  }

  static async searchCount(search) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT COUNT(*) FROM platforms WHERE name ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT * FROM platforms ORDER BY id LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  static async searchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT * FROM platforms WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return result.rows;
  }

  static async select2Search(search = '', limit = 20) {
    let sql = 'SELECT id, name FROM platforms';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY id LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM platforms WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  // Find platforms by exact name match
  static async findByNameExact(name) {
    const sql = 'SELECT * FROM platforms WHERE LOWER(name) = LOWER($1) ORDER BY id';
    const result = await pool.query(sql, [name]);
    return result.rows;
  }
}

export default Platform;