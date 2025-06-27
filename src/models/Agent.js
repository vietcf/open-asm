// Agent model for PostgreSQL
const { pool } = require('../../config/config');

class Agent {
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

  static async createAgent({ name, version, description }) {
    if (!name || !name.trim()) throw new Error('Agent Name is required!');
    const res = await pool.query(
      'INSERT INTO agents (name, version, description) VALUES ($1, $2, $3) RETURNING *',
      [name, version, description]
    );
    return res.rows[0];
  }

  static async updateAgent(id, { name, version, description }) {
    if (!name || !name.trim()) throw new Error('Agent Name is required!');
    const res = await pool.query(
      'UPDATE agents SET name = $1, version = $2, description = $3 WHERE id = $4 RETURNING *',
      [name, version, description, id]
    );
    return res.rows[0];
  }

  static async deleteAgent(id) {
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

  // Filtered agent list with pagination, search
  static async filterList({ search = '', page = 1, pageSize = 10 }) {
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
  static async filterCount({ search = '' }) {
    let sql = 'SELECT COUNT(*) FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}

module.exports = Agent;
