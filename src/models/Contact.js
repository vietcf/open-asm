const { pool } = require('../../config/config');

class Contact {
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM contacts');
    return parseInt(result.rows[0].count, 10);
  }

  static async searchCount(search) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT COUNT(*) FROM contacts
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR position ILIKE $1`,
      [q]
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       ORDER BY c.id
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  static async searchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1 OR c.position ILIKE $1 OR u.name ILIKE $1
       ORDER BY c.id
       LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // Find a contact by email (case-insensitive)
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE lower(email) = lower($1)',
      [email]
    );
    return result.rows[0];
  }

  static async create({ name, email, phone, position, unit_id }) {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, phone, position, unit_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, phone, position, unit_id || null]
    );
    return result.rows[0];
  }

  static async update(id, { name, email, phone, position, unit_id }) {
    const result = await pool.query(
      `UPDATE contacts SET name=$1, email=$2, phone=$3, position=$4, unit_id=$5
       WHERE id=$6 RETURNING *`,
      [name, email, phone, position, unit_id || null, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM contacts ORDER BY id');
    return result.rows;
  }

  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query(
      `SELECT c.*, u.name AS unit_name
       FROM contacts c
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE c.id = ANY($1::int[])`,
      [ids]
    );
    return result.rows;
  }
}

module.exports = Contact;