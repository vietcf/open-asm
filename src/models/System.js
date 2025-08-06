import { pool } from '../../config/config.js';

class System {
  // ===== CRUD METHODS =====
  static async create({ system_id, name, level, department_id, alias, description, updated_by }) {
    const result = await pool.query(
      `INSERT INTO systems (system_id, name, level, department_id, alias, description, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [system_id, name, level, department_id, alias, description, updated_by]
    );
    return result.rows[0];
  }

  static async findAll(page = 1, pageSize = 10) {
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

  static async update(id, { system_id, name, level, department_id, alias, description, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE systems SET system_id=$1, name=$2, level=$3, department_id=$4, alias=$5, description=$6, updated_at=CURRENT_TIMESTAMP, updated_by=$7
       WHERE id=$8 RETURNING *`,
      [system_id, name, level, department_id, alias, description, updated_by, id]
    );
    return result.rows[0];
  }

  static async remove(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM systems WHERE id = $1', [id]);
  }

  // ===== RELATIONSHIP/UTILITY METHODS =====
  static async setContacts(systemId, managers, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_contact WHERE system_id = $1', [systemId]);
    if (managers && managers.length > 0) {
      for (const contactId of managers) {
        await executor.query('INSERT INTO system_contact (system_id, contact_id) VALUES ($1, $2)', [systemId, contactId]);
      }
    }
  }

  static async addContacts(systemId, managers, client) {
    const executor = client || pool;
    if (managers && managers.length > 0) {
      for (const contactId of managers) {
        await executor.query('INSERT INTO system_contact (system_id, contact_id) VALUES ($1, $2)', [systemId, contactId]);
      }
    }
  }

  static async setIPs(systemId, ip_addresses, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_ip WHERE system_id = $1', [systemId]);
    if (ip_addresses && ip_addresses.length > 0) {
      for (const ipId of ip_addresses) {
        await executor.query('INSERT INTO system_ip (system_id, ip_id) VALUES ($1, $2)', [systemId, ipId]);
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

  static async setDomains(systemId, domains, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_domain WHERE system_id = $1', [systemId]);
    if (domains && domains.length > 0) {
      for (const domainId of domains) {
        await executor.query('INSERT INTO system_domain (system_id, domain_id) VALUES ($1, $2)', [systemId, domainId]);
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

  static async setTags(systemId, tagIds, client) {
    const executor = client || pool;
    // Remove all current tags for this system
    await executor.query(
      "DELETE FROM tag_object WHERE object_type = 'system' AND object_id = $1",
      [systemId]
    );
    // Add new tags
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await executor.query(
          "INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('system', $1, $2)",
          [systemId, tagId]
        );
      }
    }
  }

  static async addTags(systemId, tagIds, client) {
    const executor = client || pool;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await executor.query(
          "INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('system', $1, $2) ON CONFLICT DO NOTHING",
          [systemId, tagId]
        );
      }
    }
  }

  static async deleteTags(systemId, client) {
    const executor = client || pool;
    await executor.query(
      "DELETE FROM tag_object WHERE object_type = 'system' AND object_id = $1",
      [systemId]
    );
  }

  static async deleteIPs(systemId, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_ip WHERE system_id = $1', [systemId]);
  }

  static async deleteContacts(systemId, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_contact WHERE system_id = $1', [systemId]);
  }

  static async deleteDomains(systemId, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_domain WHERE system_id = $1', [systemId]);
  }

  static async deleteServers(systemId, client) {
    const executor = client || pool;
    // If there's a system_server relationship table, delete from it
    // Otherwise, this method can be empty or remove servers that belong to this system
    // For now, keeping it empty as the relationship might not exist
  }

  static async delete(id, client) {
    // Alias for remove method to maintain consistency
    return await System.remove(id, client);
  }

  // ===== FILTERED LIST & PAGINATION =====
  static async findFilteredList({ search = '', page = 1, pageSize = 10 }) {
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

  static async countFiltered({ search = '' }) {
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

  // ===== SELECT2 AJAX SEARCH (for dropdowns) =====
  static async select2Search({ search = '', limit = 20 }) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT id, name, system_id FROM systems
       WHERE name ILIKE $1 OR system_id ILIKE $1
       ORDER BY name ASC
       LIMIT $2`,
      [q, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      text: row.name ? `${row.name} (${row.system_id})` : row.system_id
    }));
  }

  // ===== RELATIONSHIP/UTILITY GETTERS =====
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

  static async getTagIds(systemId) {
    const result = await pool.query(
      "SELECT tag_id FROM tag_object WHERE object_type = 'system' AND object_id = $1",
      [systemId]
    );
    return result.rows.map(row => row.tag_id);
  }

  // ===== EXISTENCE CHECKER =====
  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM systems WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  /**
   * Get multiple systems by array of ids
   * @param {Array<number|string>} ids
   * @returns {Promise<Array>}
   */
  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM systems WHERE id = ANY($1)', [ids]);
    return result.rows;
  }

  // Find systems by exact name match
  static async findByNameExact(name) {
    const sql = 'SELECT * FROM systems WHERE LOWER(name) = LOWER($1) ORDER BY id';
    const result = await pool.query(sql, [name]);
    return result.rows;
  }
}

export default System;