import { pool } from '../../config/config.js';

class SystemComponent {
  // Count components by system_id
  static async countBySystemId(system_id, client) {
    const executor = client || pool;
    const result = await executor.query(
      'SELECT COUNT(*) FROM system_components WHERE system_id = $1',
      [system_id]
    );
    return parseInt(result.rows[0].count, 10);
  }
  // ===== CRUD METHODS =====
  static async create({ system_id, name, description, app_type, fqdn, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO system_components (system_id, name, description, app_type, fqdn, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [system_id, name, description, app_type, fqdn, updated_by]
    );
    return result.rows[0];
  }

  static async findAll(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT sc.*, s.name AS system_name
       FROM system_components sc
       LEFT JOIN systems s ON sc.system_id = s.id
       ORDER BY sc.id DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT sc.*, s.name AS system_name
       FROM system_components sc
       LEFT JOIN systems s ON sc.system_id = s.id
       WHERE sc.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async update(id, { system_id, name, description, app_type, fqdn, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE system_components SET system_id = $1, name = $2, description = $3, app_type = $4, fqdn = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [system_id, name, description, app_type, fqdn, updated_by, id]
    );
    return result.rows[0];
  }

  static async delete(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_components WHERE id = $1', [id]);
  }

  // ===== RELATIONSHIP METHODS =====
  static async setContacts(componentId, contactIds, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_component_contact WHERE component_id = $1', [componentId]);
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      for (const contactId of contactIds) {
        await executor.query('INSERT INTO system_component_contact (component_id, contact_id) VALUES ($1, $2)', [componentId, contactId]);
      }
    }
  }

  static async setIPs(componentId, ipIds, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM system_component_ip WHERE component_id = $1', [componentId]);
    if (Array.isArray(ipIds) && ipIds.length > 0) {
      for (const ipId of ipIds) {
        await executor.query('INSERT INTO system_component_ip (component_id, ip_id) VALUES ($1, $2)', [componentId, ipId]);
      }
    }
  }

  static async getContacts(componentId) {
    const result = await pool.query(
      `SELECT c.* FROM system_component_contact scc
       JOIN contacts c ON scc.contact_id = c.id
       WHERE scc.component_id = $1`,
      [componentId]
    );
    return result.rows;
  }

  static async getIPs(componentId) {
    const result = await pool.query(
      `SELECT ip.* FROM system_component_ip sci
       JOIN ip_addresses ip ON sci.ip_id = ip.id
       WHERE sci.component_id = $1`,
      [componentId]
    );
    return result.rows;
  }

  // ===== TAG RELATIONSHIP METHODS =====
  static async setTags(componentId, tagIds, client) {
    const executor = client || pool;
    // Remove all current tags for this component
    await executor.query(
      "DELETE FROM tag_object WHERE object_type = 'component' AND object_id = $1",
      [componentId]
    );
    // Add new tags
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await executor.query(
          "INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('component', $1, $2)",
          [componentId, tagId]
        );
      }
    }
  }

  static async addTags(componentId, tagIds, client) {
    const executor = client || pool;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await executor.query(
          "INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('component', $1, $2) ON CONFLICT DO NOTHING",
          [componentId, tagId]
        );
      }
    }
  }

  static async deleteTags(componentId, client) {
    const executor = client || pool;
    await executor.query(
      "DELETE FROM tag_object WHERE object_type = 'component' AND object_id = $1",
      [componentId]
    );
  }

  // ===== FILTERED LIST & PAGINATION =====
  static async findFilteredList({ search = '', page = 1, pageSize = 20, system_id = null }) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    // Build WHERE clause
    let where = '1=1';
    const params = [];
    let idx = 1;
    if (search) {
      where += ` AND (
        sc.name ILIKE $${idx}
        OR sc.description ILIKE $${idx}
        OR sc.app_type ILIKE $${idx}
        OR EXISTS (SELECT 1 FROM unnest(sc.fqdn) f WHERE f ILIKE $${idx})
        OR ip.ip_address::text ILIKE $${idx}
      )`;
      params.push(q);
      idx++;
    }
    // Filter by tags
    const filterTags = arguments[0].filterTags || [];
    if (filterTags.length > 0) {
      where += ` AND EXISTS (SELECT 1 FROM tag_object tobj2 WHERE tobj2.object_type = 'component' AND tobj2.object_id = sc.id AND tobj2.tag_id = ANY($${idx}))`;
      params.push(filterTags.map(Number));
      idx++;
    }
    // Filter by contacts. '__none__' means "no contact assigned" (NOT EXISTS),
    // combined with OR when real contact ids are also selected alongside it.
    const filterContacts = arguments[0].filterContacts || [];
    if (filterContacts.length > 0) {
      const noneContactSelected = filterContacts.includes('__none__');
      const realContactIds = filterContacts.filter(id => id !== '__none__').map(Number);
      const noneContactClause = `NOT EXISTS (SELECT 1 FROM system_component_contact scc3 WHERE scc3.component_id = sc.id)`;
      if (realContactIds.length > 0) {
        const existsClause = `EXISTS (SELECT 1 FROM system_component_contact scc2 WHERE scc2.component_id = sc.id AND scc2.contact_id = ANY($${idx}))`;
        where += ` AND ` + (noneContactSelected ? `(${noneContactClause} OR ${existsClause})` : existsClause);
        params.push(realContactIds);
        idx++;
      } else if (noneContactSelected) {
        where += ` AND ${noneContactClause}`;
      }
    }
    // Filter by system_id (handle both single and array). system_id is NOT
    // NULL in the schema, so there's no "__none__" case to support here.
    if (system_id && ((Array.isArray(system_id) && system_id.length > 0) || (!Array.isArray(system_id) && system_id))) {
      if (Array.isArray(system_id)) {
        where += ` AND sc.system_id = ANY($${idx})`;
        params.push(system_id.map(Number));
      } else {
        where += ` AND sc.system_id = $${idx}`;
        params.push(Number(system_id));
      }
      idx++;
    }
    // Filter by app_type (handle both single and array). '__none__' means
    // "no app type set".
    const app_type = arguments[0].app_type;
    if (app_type && ((Array.isArray(app_type) && app_type.length > 0) || (!Array.isArray(app_type) && app_type))) {
      const appTypeArr = Array.isArray(app_type) ? app_type : [app_type];
      const noneAppTypeSelected = appTypeArr.includes('__none__');
      const realAppTypes = appTypeArr.filter(v => v !== '__none__');
      const noneAppTypeClause = `(sc.app_type IS NULL OR sc.app_type = '')`;
      if (realAppTypes.length > 0) {
        const matchClause = `sc.app_type = ANY($${idx})`;
        where += ` AND ` + (noneAppTypeSelected ? `(${noneAppTypeClause} OR ${matchClause})` : matchClause);
        params.push(realAppTypes);
        idx++;
      } else if (noneAppTypeSelected) {
        where += ` AND ${noneAppTypeClause}`;
      }
    }
    params.push(pageSize, offset);
    const sql = `
      SELECT sc.*,
        s.name AS system_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip', ip.ip_address, 'server_name', srv.name)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses
      FROM system_components sc
      LEFT JOIN systems s ON sc.system_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'component' AND tobj.object_id = sc.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN system_component_contact scc ON scc.component_id = sc.id
      LEFT JOIN contacts c ON c.id = scc.contact_id
      LEFT JOIN system_component_ip sci ON sci.component_id = sc.id
      LEFT JOIN ip_addresses ip ON ip.id = sci.ip_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
      LEFT JOIN servers srv ON srv.id = svi.server_id
      WHERE ${where}
      GROUP BY sc.id, s.name
      ORDER BY sc.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const result = await pool.query(sql, params);
    // Normalize keys to the legacy names (contacts, ips, tags)
    return result.rows.map(row => {
      row.ips = row.ip_addresses;
      delete row.ip_addresses;
      return row;
    });
  }

  static async countFiltered({ search = '', system_id = null }) {
    const q = `%${search}%`;
    let where = '1=1';
    const params = [];
    let idx = 1;
    if (search) {
      where += ` AND (sc.name ILIKE $${idx} OR sc.description ILIKE $${idx} OR sc.app_type ILIKE $${idx} OR EXISTS (SELECT 1 FROM unnest(sc.fqdn) f WHERE f ILIKE $${idx}))`;
      params.push(q);
      idx++;
    }
    // Filter by tags
    const filterTags = arguments[0].filterTags || [];
    if (filterTags.length > 0) {
      where += ` AND EXISTS (SELECT 1 FROM tag_object tobj2 WHERE tobj2.object_type = 'component' AND tobj2.object_id = sc.id AND tobj2.tag_id = ANY($${idx}))`;
      params.push(filterTags.map(Number));
      idx++;
    }
    // Filter by contacts. '__none__' means "no contact assigned" (NOT EXISTS),
    // combined with OR when real contact ids are also selected alongside it.
    const filterContacts = arguments[0].filterContacts || [];
    if (filterContacts.length > 0) {
      const noneContactSelected = filterContacts.includes('__none__');
      const realContactIds = filterContacts.filter(id => id !== '__none__').map(Number);
      const noneContactClause = `NOT EXISTS (SELECT 1 FROM system_component_contact scc3 WHERE scc3.component_id = sc.id)`;
      if (realContactIds.length > 0) {
        const existsClause = `EXISTS (SELECT 1 FROM system_component_contact scc2 WHERE scc2.component_id = sc.id AND scc2.contact_id = ANY($${idx}))`;
        where += ` AND ` + (noneContactSelected ? `(${noneContactClause} OR ${existsClause})` : existsClause);
        params.push(realContactIds);
        idx++;
      } else if (noneContactSelected) {
        where += ` AND ${noneContactClause}`;
      }
    }
    // Filter by system_id (handle both single and array). system_id is NOT
    // NULL in the schema, so there's no "__none__" case to support here.
    if (system_id && ((Array.isArray(system_id) && system_id.length > 0) || (!Array.isArray(system_id) && system_id))) {
      if (Array.isArray(system_id)) {
        where += ` AND sc.system_id = ANY($${idx})`;
        params.push(system_id.map(Number));
      } else {
        where += ` AND sc.system_id = $${idx}`;
        params.push(Number(system_id));
      }
      idx++;
    }
    // Filter by app_type (handle both single and array). '__none__' means
    // "no app type set".
    const app_type = arguments[0].app_type;
    if (app_type && ((Array.isArray(app_type) && app_type.length > 0) || (!Array.isArray(app_type) && app_type))) {
      const appTypeArr = Array.isArray(app_type) ? app_type : [app_type];
      const noneAppTypeSelected = appTypeArr.includes('__none__');
      const realAppTypes = appTypeArr.filter(v => v !== '__none__');
      const noneAppTypeClause = `(sc.app_type IS NULL OR sc.app_type = '')`;
      if (realAppTypes.length > 0) {
        const matchClause = `sc.app_type = ANY($${idx})`;
        where += ` AND ` + (noneAppTypeSelected ? `(${noneAppTypeClause} OR ${matchClause})` : matchClause);
        params.push(realAppTypes);
        idx++;
      } else if (noneAppTypeSelected) {
        where += ` AND ${noneAppTypeClause}`;
      }
    }
    const result = await pool.query(
      `SELECT COUNT(*) FROM system_components sc WHERE ${where}`,
      params
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Get total count of all components
  static async count() {
    const result = await pool.query('SELECT COUNT(*) AS count FROM system_components');
    return parseInt(result.rows[0].count, 10);
  }

  // Check if a system component exists by id
  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM system_components WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Check if a component name is already used within the same system
  // (case-insensitive), optionally excluding one component id (for updates).
  static async existsByName(system_id, name, excludeId) {
    const params = [system_id, name];
    let sql = 'SELECT 1 FROM system_components WHERE system_id = $1 AND LOWER(name) = LOWER($2)';
    if (excludeId != null) {
      params.push(excludeId);
      sql += ' AND id != $3';
    }
    const result = await pool.query(sql, params);
    return result.rowCount > 0;
  }

  static async select2Search({ search = '', limit = 20 }) {
    let sql = 'SELECT id, name FROM system_components';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    // Select2 expects: { results: [ { id, text } ] }
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  // Get one component with its tags, contacts and ip_addresses
  static async findByIdWithRelations(id) {
    const sql = `
      SELECT sc.*,
        s.name AS system_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'server_name', srv.name)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses
      FROM system_components sc
      LEFT JOIN systems s ON sc.system_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'component' AND tobj.object_id = sc.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN system_component_contact scc ON scc.component_id = sc.id
      LEFT JOIN contacts c ON c.id = scc.contact_id
      LEFT JOIN system_component_ip sci ON sci.component_id = sc.id
      LEFT JOIN ip_addresses ip ON ip.id = sci.ip_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
      LEFT JOIN servers srv ON srv.id = svi.server_id
      WHERE sc.id = $1
      GROUP BY sc.id, s.name
      LIMIT 1
    `;
    const result = await pool.query(sql, [id]);
  if (!result.rows[0]) return null;
  // Normalize keys to the legacy names (contacts, ips, tags)
  const row = result.rows[0];
  row.ips = row.ip_addresses || [];
  delete row.ip_addresses;
  return row;
  }
}

export default SystemComponent;
