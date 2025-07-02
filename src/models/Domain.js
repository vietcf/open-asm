const { pool } = require('../../config/config');

class Domain {
  static async findAll() {
    const res = await pool.query('SELECT * FROM domains ORDER BY id');
    return res.rows;
  }

  static async findPage(page = 1, pageSize = 10, search = '') {
    let sql, params;
    if (search) {
      sql = 'SELECT * FROM domains WHERE domain ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3';
      params = [`%${search}%`, pageSize, (page - 1) * pageSize];
    } else {
      sql = 'SELECT * FROM domains ORDER BY id LIMIT $1 OFFSET $2';
      params = [pageSize, (page - 1) * pageSize];
    }
    const res = await pool.query(sql, params);
    return res.rows;
  }

  static async countAll(search = '') {
    let sql = 'SELECT COUNT(*) FROM domains';
    let params = [];
    if (search) {
      sql += ' WHERE domain ILIKE $1';
      params.push(`%${search}%`);
    }
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  static async findById(id) {
    const res = await pool.query('SELECT * FROM domains WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create({ domain, description, ip_id = null, record_type = null }) {
    const res = await pool.query(
      'INSERT INTO domains (domain, description, ip_id, record_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [domain, description || null, ip_id, record_type]
    );
    return res.rows[0];
  }

  static async update(id, { domain, description, ip_id = null, record_type = null }) {
    // Cho phép cập nhật description, ip_id, record_type
    const res = await pool.query(
      'UPDATE domains SET description = $1, ip_id = $2, record_type = $3 WHERE id = $4 RETURNING *',
      [description, ip_id, record_type, id]
    );
    return res.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM domains WHERE id = $1', [id]);
  }

  // Complex: Get all systems of a domain (many-to-many)
  static async getSystems(domainId) {
    const res = await pool.query(
      `SELECT s.* FROM systems s
       JOIN system_domain sd ON s.id = sd.system_id
       WHERE sd.domain_id = $1`,
      [domainId]
    );
    return res.rows;
  }

  // Complex: Add domain to system
  static async addToSystem(domainId, systemId) {
    await pool.query(
      'INSERT INTO system_domain (domain_id, system_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [domainId, systemId]
    );
  }

  // Complex: Remove domain from system
  static async removeFromSystem(domainId, systemId) {
    await pool.query(
      'DELETE FROM system_domain WHERE domain_id = $1 AND system_id = $2',
      [domainId, systemId]
    );
  }

  // Đếm số domain theo nhiều trường (domain, description, ip, system)
  static async searchCount(search) {
    const searchQuery = `%${search}%`;
    const res = await pool.query(`
      SELECT COUNT(DISTINCT d.id) AS count
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      WHERE d.domain ILIKE $1 OR d.description ILIKE $1 OR ip.ip_address::text ILIKE $1 OR s.name ILIKE $1
    `, [searchQuery]);
    return parseInt(res.rows[0].count, 10);
  }

  // Lấy danh sách domain theo nhiều trường (domain, description, ip, system)
  static async searchPage(search, page, pageSize) {
    const searchQuery = `%${search}%`;
    const offset = (page - 1) * pageSize;
    const res = await pool.query(`
      SELECT DISTINCT d.*
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      WHERE d.domain ILIKE $1 OR d.description ILIKE $1 OR ip.ip_address::text ILIKE $1 OR s.name ILIKE $1
      ORDER BY d.id DESC
      LIMIT $2 OFFSET $3
    `, [searchQuery, pageSize, offset]);
    return res.rows;
  }

  // Tạo domain và gán systems (transaction ngoài controller)
  static async createDomain({ domain, description, ip_id, record_type, systems = [] }, client) {
    const res = await client.query(
      'INSERT INTO domains (domain, description, ip_id, record_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [domain, description || null, ip_id, record_type]
    );
    const newDomain = res.rows[0];
    for (const sysId of systems) {
      await client.query('INSERT INTO system_domain (domain_id, system_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newDomain.id, sysId]);
    }
    return newDomain;
  }

  // Update domain và gán lại systems (transaction ngoài controller)
  static async updateDomain(id, { description, ip_id, record_type, systems = [] }, client) {
    await client.query(
      'UPDATE domains SET description = $1, ip_id = $2, record_type = $3 WHERE id = $4',
      [description, ip_id, record_type, id]
    );
    await client.query('DELETE FROM system_domain WHERE domain_id = $1', [id]);
    for (const sysId of systems) {
      await client.query('INSERT INTO system_domain (domain_id, system_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, sysId]);
    }
  }

  // Xóa domain và xóa liên kết system_domain (transaction ngoài controller)
  static async deleteDomain(id, client) {
    await client.query('DELETE FROM system_domain WHERE domain_id = $1', [id]);
    await client.query('DELETE FROM domains WHERE id = $1', [id]);
  }

  // Lấy thông tin IP cho domain (trả về {id, ip_address} hoặc null)
  static async getIp(ip_id) {
    if (!ip_id) return null;
    const res = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE id = $1', [ip_id]);
    return res.rows[0] || null;
  }
}

module.exports = Domain;
