const { pool } = require('../../config/config');

class Unit {
  static async findAll() {
    const result = await pool.query('SELECT * FROM units ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [id]);
    return result.rows[0];
  }
  // Create a new unit
  static async create({ name, code, description }) {
    const result = await pool.query(
      `INSERT INTO units (name, code, description) VALUES ($1, $2, $3) RETURNING *`,
      [name, code, description]
    );
    return result.rows[0];
  }
  // Update an existing unit
  static async update(id, { name, code, description }) {
    const result = await pool.query(
      `UPDATE units SET name=$1, code=$2, description=$3 WHERE id=$4 RETURNING *`,
      [name, code, description, id]
    );
    return result.rows[0];
  }
  // Delete a unit
  static async delete(id) {
    await pool.query('DELETE FROM units WHERE id = $1', [id]);
  }

  // Count total units
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM units');
    return parseInt(result.rows[0].count, 10);
  }

  // Count units matching search term
  static async searchCount(search) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT COUNT(*) FROM units WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1`,
      [q]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Get a page of units
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT * FROM units ORDER BY id LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  // Search units with pagination
  static async searchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT * FROM units WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return result.rows;
  }

  // Find a unit by name (case-insensitive, trim)
  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM units WHERE lower(trim(name)) = lower(trim($1))',
      [name]
    );
    return result.rows[0];
  }
}

module.exports = Unit;