import { pool } from '../../config/config.js';

class Platform {
  static async create({ name, description }) {
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

  static async update(id, description) {
    const result = await pool.query(
      `UPDATE platforms SET description=$1 WHERE id=$2 RETURNING *`,
      [description, id]
    );
    return result.rows[0];
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
}

export default Platform;