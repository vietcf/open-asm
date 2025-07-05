const { pool } = require('../../config/config');

class System {
  // AJAX API: Search systems for select2 (id, text)
  static async apiSystemSearch({ search = '' }) {
    const q = `%${search}%`;
    // Only return id and text (system name or system_id)
    const result = await pool.query(
      `SELECT id, name, system_id FROM systems
       WHERE name ILIKE $1 OR system_id ILIKE $1
       ORDER BY name ASC
       LIMIT 20`,
      [q]
    );
    // Format for select2: [{ id, text }]
    return result.rows.map(row => ({
      id: row.id,
      text: row.name ? `${row.name} (${row.system_id})` : row.system_id
    }));
  }
  static async findPage(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT s.*, u.name AS department_name,
        ARRAY(
          SELECT c.name FROM system_contact sc
          JOIN contacts c ON sc.contact_id = c.id
          WHERE sc.system_id = s.id
        ) AS managers
       FROM systems s
       LEFT JOIN units u ON s.department_id = u.id
       ORDER BY s.id
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM systems');
    return parseInt(result.rows[0].count, 10);
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT s.*, u.name AS department_name,
        ARRAY(
          SELECT c.name FROM system_contact sc
          JOIN contacts c ON sc.contact_id = c.id
          WHERE sc.system_id = s.id
        ) AS managers
       FROM systems s
       LEFT JOIN units u ON s.department_id = u.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async create({ system_id, name, level, department_id, alias, description, updated_by }) {
    const result = await pool.query(
      `INSERT INTO systems (system_id, name, level, department_id, alias, description, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [system_id, name, level, department_id, alias, description, updated_by]
    );
    return result.rows[0];
  }

  static async updateMain(id, { system_id, name, level, department_id, alias, description, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE systems SET system_id=$1, name=$2, level=$3, department_id=$4, alias=$5, description=$6, updated_at=CURRENT_TIMESTAMP, updated_by=$7
       WHERE id=$8 RETURNING *`,
      [system_id, name, level, department_id, alias, description, updated_by, id]
    );
    return result.rows[0];
  }

  static async updateContacts(id, managers, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_contact WHERE system_id = $1', [id]);
    if (managers && managers.length > 0) {
      for (const contactId of managers) {
        await executor.query('INSERT INTO system_contact (system_id, contact_id) VALUES ($1, $2)', [id, contactId]);
      }
    }
  }

  static async updateIPs(id, ip_addresses, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_ip WHERE system_id = $1', [id]);
    if (ip_addresses && ip_addresses.length > 0) {
      for (const ipId of ip_addresses) {
        await executor.query('INSERT INTO system_ip (system_id, ip_id) VALUES ($1, $2)', [id, ipId]);
      }
    }
  }

  static async updateDomains(id, domains, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_domain WHERE system_id = $1', [id]);
    if (domains && domains.length > 0) {
      for (const domainId of domains) {
        await executor.query('INSERT INTO system_domain (system_id, domain_id) VALUES ($1, $2)', [id, domainId]);
      }
    }
  }

  static async updateTags(id, tags, client) {
    const executor = client || pool;
    await executor.query("DELETE FROM tag_object WHERE object_type = 'system' AND object_id = $1", [id]);
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await executor.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'system', $2) ON CONFLICT DO NOTHING",
          [tagId, id]
        );
      }
    }
  }

  static async delete(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM systems WHERE id = $1', [id]);
  }

  static async searchPage(search, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT s.*, u.name AS department_name,
        ARRAY(
          SELECT c.name FROM system_contact sc
          JOIN contacts c ON sc.contact_id = c.id
          WHERE sc.system_id = s.id
        ) AS managers
       FROM systems s
       LEFT JOIN units u ON s.department_id = u.id
       WHERE s.name ILIKE $1 OR s.system_id ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(s.alias) a WHERE a ILIKE $1)
       ORDER BY s.id
       LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    );
    return result.rows;
  }

  static async searchCount(search) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT COUNT(*) FROM systems WHERE name ILIKE $1 OR system_id ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(alias) a WHERE a ILIKE $1)`,
      [q]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Gán tag cho hệ thống
  static async setTags(systemId, tagIds) {
    // Xóa hết tag cũ trong tag_object
    await pool.query("DELETE FROM tag_object WHERE object_type = 'system' AND object_id = $1", [systemId]);
    // Thêm tag mới
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await pool.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'system', $2) ON CONFLICT DO NOTHING",
          [tagId, systemId]
        );
      }
    }
  }
  // Lấy danh sách tag id của hệ thống
  static async getTagIds(systemId) {
    const result = await pool.query(
      "SELECT tag_id FROM tag_object WHERE object_type = 'system' AND object_id = $1",
      [systemId]
    );
    return result.rows.map(row => row.tag_id);
  }

  // Lấy danh sách hệ thống với join đầy đủ, trả về các trường liên kết dạng JSON
  static async filterList({ search = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    const result = await pool.query(`
      SELECT s.*,
        u.name AS department_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip', ip.ip_address, 'server_name', srv.name)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', d.id, 'domain', d.domain)) FILTER (WHERE d.id IS NOT NULL), '[]') AS domains,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', f.id, 'name', f.original_name, 'url', f.file_path)) FILTER (WHERE f.id IS NOT NULL), '[]') AS docs
      FROM systems s
      LEFT JOIN units u ON s.department_id = u.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'system' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN system_contact sc ON sc.system_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN system_ip sip ON sip.system_id = s.id
      LEFT JOIN ip_addresses ip ON ip.id = sip.ip_id
      LEFT JOIN servers srv ON ip.server_id = srv.id
      LEFT JOIN system_domain sd ON sd.system_id = s.id
      LEFT JOIN domains d ON d.id = sd.domain_id
      LEFT JOIN file_uploads f ON f.object_type = 'system' AND f.object_id = s.id
      WHERE (
        $1 = '' OR
        s.name ILIKE $2 OR
        s.system_id ILIKE $2 OR
        EXISTS (SELECT 1 FROM unnest(s.alias) a WHERE a ILIKE $2) OR
        t.name ILIKE $2 OR
        c.name ILIKE $2 OR
        ip.ip_address::text ILIKE $2 OR
        d.domain ILIKE $2
      )
      GROUP BY s.id, u.name
      ORDER BY s.id
      LIMIT $3 OFFSET $4
    `, [search, q, pageSize, offset]);
    return result.rows;
  }

  static async filterCount({ search = '' }) {
    const q = `%${search}%`;
    const result = await pool.query(`
      SELECT COUNT(DISTINCT s.id) AS count
      FROM systems s
      LEFT JOIN tag_object tobj ON tobj.object_type = 'system' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN system_contact sc ON sc.system_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN system_ip sip ON sip.system_id = s.id
      LEFT JOIN ip_addresses ip ON ip.id = sip.ip_id
      LEFT JOIN system_domain sd ON sd.system_id = s.id
      LEFT JOIN domains d ON d.id = sd.domain_id
      WHERE (
        $1 = '' OR
        s.name ILIKE $2 OR
        s.system_id ILIKE $2 OR
        EXISTS (SELECT 1 FROM unnest(s.alias) a WHERE a ILIKE $2) OR
        t.name ILIKE $2 OR
        c.name ILIKE $2 OR
        ip.ip_address::text ILIKE $2 OR
        d.domain ILIKE $2
      )
    `, [search, q]);
    return parseInt(result.rows[0].count, 10);
  }

  static async getContactsBySystemId(systemId) {
    const result = await pool.query('SELECT contact_id FROM system_contact WHERE system_id = $1', [systemId]);
    return result.rows.map(row => row.contact_id);
  }

  static async getIpIdsBySystemId(systemId) {
    const result = await pool.query('SELECT ip_id FROM system_ip WHERE system_id = $1', [systemId]);
    return result.rows.map(row => row.ip_id);
  }

  static async getIpAddressesByIds(ipIds) {
    if (!ipIds || ipIds.length === 0) return [];
    const result = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE id = ANY($1)', [ipIds]);
    return result.rows;
  }

  static async getDomainsBySystemId(systemId) {
    const result = await pool.query('SELECT d.id, d.domain FROM system_domain sd JOIN domains d ON sd.domain_id = d.id WHERE sd.system_id = $1', [systemId]);
    return result.rows.map(row => ({ id: row.id, name: row.domain }));
  }

  static async addContacts(systemId, managers, client) {
    const executor = client || pool;
    if (managers && managers.length > 0) {
      for (const contactId of managers) {
        await executor.query('INSERT INTO system_contact (system_id, contact_id) VALUES ($1, $2)', [systemId, contactId]);
      }
    }
  }

  static async addIPs(systemId, ip_addresses, client) {
    const executor = client || pool;
    if (ip_addresses && ip_addresses.length > 0) {
      for (const ipId of ip_addresses) {
        await executor.query('INSERT INTO system_ip (system_id, ip_id) VALUES ($1, $2)', [systemId, ipId]);
      }
    }
  }

  static async addDomains(systemId, domains, client) {
    const executor = client || pool;
    if (domains && domains.length > 0) {
      for (const domainId of domains) {
        await executor.query('INSERT INTO system_domain (system_id, domain_id) VALUES ($1, $2)', [systemId, domainId]);
      }
    }
  }

  static async addTags(systemId, tags, client) {
    const executor = client || pool;
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await executor.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'system', $2) ON CONFLICT DO NOTHING",
          [tagId, systemId]
        );
      }
    }
  }

  static async deleteTags(id, client) {
    const executor = client || pool;
    await executor.query("DELETE FROM tag_object WHERE object_type = 'system' AND object_id = $1", [id]);
  }

  static async deleteIPs(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_ip WHERE system_id = $1', [id]);
  }

  static async deleteContacts(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_contact WHERE system_id = $1', [id]);
  }

  static async deleteDomains(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_domain WHERE system_id = $1', [id]);
  }

  static async deleteServers(id, client) {
    const executor = client || pool;
    try {
      await executor.query('DELETE FROM system_server WHERE system_id = $1', [id]);
    } catch (e) { /* Table not found, skip */ }
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM systems WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}

module.exports = System;