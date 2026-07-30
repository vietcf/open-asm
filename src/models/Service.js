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

  // server_services.service_id is ON DELETE CASCADE, so the DB itself never
  // blocks delete() (the "foreign key constraint" catch there can never
  // fire) — callers that want to prevent deleting an in-use service must
  // check this first.
  static async countServersUsing(id) {
    const result = await pool.query('SELECT COUNT(*) FROM server_services WHERE service_id = $1', [id]);
    return parseInt(result.rows[0].count, 10);
  }

  // Get services by array of ids
  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const result = await pool.query(`SELECT * FROM services WHERE id IN (${placeholders}) ORDER BY name`, ids);
    return result.rows;
  }

  // Update a service (partial update - only update provided fields)
  static async update(id, updateData) {
    // Build dynamic query based on provided fields
    const fields = Object.keys(updateData);
    if (fields.length === 0) {
      return await this.findById(id);
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = fields.map(field => updateData[field]);
    values.push(id); // Add id as last parameter
    
    const query = `UPDATE services SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Delete a service
  static async delete(id) {
    try {
      const res = await pool.query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
      if (res.rowCount === 0) {
        throw new Error('Service not found.');
      }
      return res.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('foreign key constraint')) {
        throw new Error('Cannot delete: This service is in use.');
      }
      throw err;
    }
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

  // Count all services with optional search filter (for legacy controller)
  static async countAll(search = '') {
    if (search) {
      const q = `%${search}%`;
      const result = await pool.query('SELECT COUNT(*) FROM services WHERE LOWER(name) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1)', [q]);
      return parseInt(result.rows[0].count, 10);
    } else {
      const result = await pool.query('SELECT COUNT(*) FROM services');
      return parseInt(result.rows[0].count, 10);
    }
  }

  // Find services with pagination and search (for legacy controller)
  static async findPage(page = 1, pageSize = 10, search = '') {
    const offset = (page - 1) * pageSize;
    if (search) {
      const q = `%${search}%`;
      const result = await pool.query('SELECT * FROM services WHERE LOWER(name) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1) ORDER BY id LIMIT $2 OFFSET $3', [q, pageSize, offset]);
      return result.rows;
    } else {
      const result = await pool.query('SELECT * FROM services ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset]);
      return result.rows;
    }
  }

  // Find services by exact name match
  static async findByNameExact(name) {
    const sql = 'SELECT * FROM services WHERE LOWER(name) = LOWER($1) ORDER BY id';
    const result = await pool.query(sql, [name]);
    return result.rows;
  }
}

export default Service;
