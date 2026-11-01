import { pool } from '../../../config/config.js';

class Cluster {
  static async create({ name, description, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO clusters (name, description, updated_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description || null, updated_by]
    );
    return result.rows[0];
  }

  static async update(id, { name, description, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE clusters SET name = $1, description = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [name, description || null, updated_by, id]
    );
    return result.rows[0];
  }

  // Members (cluster_members) and the system link (cluster_system) both
  // cascade automatically via FK ON DELETE CASCADE — no cleanup needed here.
  static async delete(id, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM clusters WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM clusters WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM clusters WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findByNameExact(name) {
    const result = await pool.query('SELECT * FROM clusters WHERE LOWER(name) = LOWER($1) ORDER BY id', [name]);
    return result.rows;
  }

  // IP address ids already in this cluster - used to reject re-adding a
  // member the Edit form's bulk file-import already has.
  static async getMemberIpIds(clusterId) {
    const result = await pool.query('SELECT ip_address_id FROM cluster_members WHERE cluster_id = $1', [clusterId]);
    return result.rows.map(r => r.ip_address_id);
  }

  static async setMembers(clusterId, members, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM cluster_members WHERE cluster_id = $1', [clusterId]);
    if (Array.isArray(members) && members.length > 0) {
      for (const m of members) {
        await executor.query(
          'INSERT INTO cluster_members (cluster_id, ip_address_id, role, updated_by) VALUES ($1, $2, $3, $4)',
          [clusterId, m.ip_address_id, m.role || null, m.updated_by || null]
        );
      }
    }
  }

  static async setSystems(clusterId, systemIds, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM cluster_system WHERE cluster_id = $1', [clusterId]);
    if (Array.isArray(systemIds) && systemIds.length > 0) {
      for (const systemId of systemIds) {
        await executor.query(
          'INSERT INTO cluster_system (cluster_id, system_id) VALUES ($1, $2)',
          [clusterId, systemId]
        );
      }
    }
  }

  // Distinct roles already in use, for the role-input autocomplete — lets
  // users pick an existing role or freely type a brand new one instead of
  // being limited to a fixed configured list.
  static async getDistinctRoles() {
    const result = await pool.query(
      `SELECT DISTINCT role FROM cluster_members WHERE role IS NOT NULL AND role != '' ORDER BY role`
    );
    return result.rows.map(r => r.role);
  }

  static async findByIdWithRelations(id) {
    const sql = `
      SELECT cl.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', cm.id, 'ip_address_id', ip.id, 'ip', ip.ip_address, 'role', cm.role,
          'server_name', srv.name, 'device_name', dev.name
        )) FILTER (WHERE cm.id IS NOT NULL), '[]') AS members
      FROM clusters cl
      LEFT JOIN cluster_system cs ON cs.cluster_id = cl.id
      LEFT JOIN systems s ON s.id = cs.system_id
      LEFT JOIN cluster_members cm ON cm.cluster_id = cl.id
      LEFT JOIN ip_addresses ip ON ip.id = cm.ip_address_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
      LEFT JOIN servers srv ON srv.id = svi.server_id
      LEFT JOIN device_ip di ON di.ip_id = ip.id AND di.role = 'normal'
      LEFT JOIN devices dev ON dev.id = di.device_id
      WHERE cl.id = $1
      GROUP BY cl.id
    `;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  }

  // Clusters serving one System — used by System Detail's AJAX-loaded
  // "Clusters" section, without System's own query knowing anything about
  // clusters.
  static async findBySystemId(systemId) {
    const sql = `
      SELECT cl.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', cm.id, 'ip_address_id', ip.id, 'ip', ip.ip_address, 'role', cm.role,
          'server_name', srv.name, 'device_name', dev.name
        )) FILTER (WHERE cm.id IS NOT NULL), '[]') AS members
      FROM clusters cl
      JOIN cluster_system cs ON cs.cluster_id = cl.id AND cs.system_id = $1
      LEFT JOIN cluster_members cm ON cm.cluster_id = cl.id
      LEFT JOIN ip_addresses ip ON ip.id = cm.ip_address_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
      LEFT JOIN servers srv ON srv.id = svi.server_id
      LEFT JOIN device_ip di ON di.ip_id = ip.id AND di.role = 'normal'
      LEFT JOIN devices dev ON dev.id = di.device_id
      GROUP BY cl.id
      ORDER BY cl.id DESC
    `;
    const result = await pool.query(sql, [systemId]);
    return result.rows;
  }

  static async findFilteredList({ search = '', role = null, system_id = null, page = 1, pageSize = 20 }) {
    const offset = (page - 1) * pageSize;
    const params = [];
    let idx = 1;
    let where = '1=1';
    if (search) {
      where += ` AND (cl.name ILIKE $${idx} OR cl.description ILIKE $${idx} OR ip.ip_address::text ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (role && (!Array.isArray(role) || role.length > 0)) {
      const roles = Array.isArray(role) ? role : [role];
      where += ` AND EXISTS (SELECT 1 FROM cluster_members cm2 WHERE cm2.cluster_id = cl.id AND cm2.role = ANY($${idx}))`;
      params.push(roles);
      idx++;
    }
    if (system_id && (!Array.isArray(system_id) || system_id.length > 0)) {
      const systemIds = (Array.isArray(system_id) ? system_id : [system_id]).map(Number);
      where += ` AND EXISTS (SELECT 1 FROM cluster_system cs2 WHERE cs2.cluster_id = cl.id AND cs2.system_id = ANY($${idx}))`;
      params.push(systemIds);
      idx++;
    }
    params.push(pageSize, offset);
    const sql = `
      SELECT cl.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', cm.id, 'ip_address_id', ip.id, 'ip', ip.ip_address, 'role', cm.role,
          'server_name', srv.name, 'device_name', dev.name
        )) FILTER (WHERE cm.id IS NOT NULL), '[]') AS members
      FROM clusters cl
      LEFT JOIN cluster_system cs ON cs.cluster_id = cl.id
      LEFT JOIN systems s ON s.id = cs.system_id
      LEFT JOIN cluster_members cm ON cm.cluster_id = cl.id
      LEFT JOIN ip_addresses ip ON ip.id = cm.ip_address_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
      LEFT JOIN servers srv ON srv.id = svi.server_id
      LEFT JOIN device_ip di ON di.ip_id = ip.id AND di.role = 'normal'
      LEFT JOIN devices dev ON dev.id = di.device_id
      WHERE ${where}
      GROUP BY cl.id
      ORDER BY cl.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const result = await pool.query(sql, params);
    return result.rows;
  }

  static async countFiltered({ search = '', role = null, system_id = null }) {
    const params = [];
    let idx = 1;
    let where = '1=1';
    if (search) {
      where += ` AND (cl.name ILIKE $${idx} OR cl.description ILIKE $${idx} OR EXISTS (SELECT 1 FROM cluster_members cm3 JOIN ip_addresses ip3 ON ip3.id = cm3.ip_address_id WHERE cm3.cluster_id = cl.id AND ip3.ip_address::text ILIKE $${idx}))`;
      params.push(`%${search}%`);
      idx++;
    }
    if (role && (!Array.isArray(role) || role.length > 0)) {
      const roles = Array.isArray(role) ? role : [role];
      where += ` AND EXISTS (SELECT 1 FROM cluster_members cm2 WHERE cm2.cluster_id = cl.id AND cm2.role = ANY($${idx}))`;
      params.push(roles);
      idx++;
    }
    if (system_id && (!Array.isArray(system_id) || system_id.length > 0)) {
      const systemIds = (Array.isArray(system_id) ? system_id : [system_id]).map(Number);
      where += ` AND EXISTS (SELECT 1 FROM cluster_system cs2 WHERE cs2.cluster_id = cl.id AND cs2.system_id = ANY($${idx}))`;
      params.push(systemIds);
      idx++;
    }
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM clusters cl WHERE ${where}`,
      params
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export default Cluster;
