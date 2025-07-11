
import { pool } from '../../config/config.js';

class Agent {
  // Create a new agent
  static async create({ name, version, description }) {
    if (!name || !name.trim()) throw new Error('Agent Name is required!');
    const result = await pool.query(
      'INSERT INTO agents (name, version, description) VALUES ($1, $2, $3) RETURNING *',
      [name, version, description]
    );
    return result.rows[0];
  }

  // Get all agents
  static async findAll() {
    const result = await pool.query('SELECT * FROM agents ORDER BY id');
    return result.rows;
  }

  // Get an agent by id
  static async findById(id) {
    const result = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Update an agent
  static async update(id, { name, version, description }) {
    if (!name || !name.trim()) throw new Error('Agent Name is required!');
    const result = await pool.query(
      'UPDATE agents SET name = $1, version = $2, description = $3 WHERE id = $4 RETURNING *',
      [name, version, description, id]
    );
    return result.rows[0];
  }

  // Delete an agent
  static async delete(id) {
    try {
      const res = await pool.query('DELETE FROM agents WHERE id = $1 RETURNING *', [id]);
      if (res.rowCount === 0) {
        throw new Error('Agent not found.');
      }
      return res.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('foreign key constraint')) {
        throw new Error('Cannot delete: This agent is in use.');
      }
      throw err;
    }
  }

  // Count all agents (optionally with search)
  static async countAll(search = '') {
    let sql = 'SELECT COUNT(*) FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search}%`);
    }
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  // Get a page of agents (optionally with search)
  static async findPage(page = 1, pageSize = 10, search = '') {
    const offset = (page - 1) * pageSize;
    let sql = 'SELECT * FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(pageSize, offset);
    const res = await pool.query(sql, params);
    return res.rows;
  }

  // Filtered agent list with pagination, search
  static async findFilteredList({ search = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    let sql = 'SELECT * FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(pageSize, offset);
    const res = await pool.query(sql, params);
    return res.rows;
  }

  // Count for filtered agent list
  static async countFiltered({ search = '' }) {
    let sql = 'SELECT COUNT(*) FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  // Check if an agent exists by id
  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  // For select2 AJAX: get agents by search (id, name, version)
  static async select2Search({ search = '', limit = 20 }) {
    let sql = 'SELECT id, name, version FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.id, text: row.version ? `${row.name} (${row.version})` : row.name }));
  }

}

export default Agent;
