import { pool } from '../../config/config.js';

class Service {
  // Create a new service
  static async create({ name, description }) {
    const result = await pool.query('INSERT INTO services (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
    return result.rows[0];
  }

  // Get all services
  static async findAll() {
    const result = await pool.query('SELECT * FROM services ORDER BY id');
    return result.rows;
  }

  // Get a service by id
  static async findById(id) {
    const result = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Update a service
  static async update(id, { name, description }) {
    const result = await pool.query('UPDATE services SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description, id]);
    return result.rows[0];
  }

  // Delete a service
  static async delete(id) {
    await pool.query('DELETE FROM services WHERE id = $1', [id]);
  }

  // Count all services (optionally with search)
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

  // Get a page of services (optionally with search)
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

  // Check if a service exists by id
  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM services WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  // For select2 AJAX: get services by search (id, name)
  static async select2Search({ search = '', limit = 20 }) {
    let sql = 'SELECT id, name FROM services';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }
}

export default Service;
