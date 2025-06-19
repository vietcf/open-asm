const pool = require('../../config/config').pool;

class Tag {
  static async findAll() {
    const result = await pool.query('SELECT * FROM tags ORDER BY id');
    return result.rows;
  }

  static async create({ name, description }) {
    const result = await pool.query(
      'INSERT INTO tags (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  }

  static async update(id, { name, description }) {
    const result = await pool.query(
      'UPDATE tags SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM tags WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM tags WHERE id = $1', [id]);
    return result.rows[0];
  }

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

  static async search(search) {
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

  static async searchForSelect2(search) {
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
}

module.exports = Tag;
