// Service model for PostgreSQL
const { pool } = require('../../config/config');

class Service {
  static async countAll(search = '') {
    let sql = 'SELECT COUNT(*) FROM services';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  static async findPage(page = 1, pageSize = 10, search = '') {
    const offset = (page - 1) * pageSize;
    let sql = 'SELECT * FROM services';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(pageSize, offset);
    const res = await pool.query(sql, params);
    return res.rows;
  }

  static async createService({ name, description }) {
    return pool.query('INSERT INTO services (name, description) VALUES ($1, $2)', [name, description]);
  }

  static async updateService(id, { name, description }) {
    return pool.query('UPDATE services SET name = $1, description = $2 WHERE id = $3', [name, description, id]);
  }

  static async deleteService(id) {
    return pool.query('DELETE FROM services WHERE id = $1', [id]);
  }
}

module.exports = Service;
