// Server model for PostgreSQL
const { pool } = require('../../config/config');

class Server {
  static async findAll() {
    const res = await pool.query('SELECT * FROM servers ORDER BY id');
    return res.rows;
  }
  static async findById(id) {
    // Lấy server + join platform name
    const res = await pool.query(
      `SELECT s.*, p.name AS platform_name
       FROM servers s
       LEFT JOIN platforms p ON p.id = s.os_id
       WHERE s.id = $1`,
      [id]
    );
    const server = res.rows[0];
    if (!server) return null;
    // Lấy IPs (trả về mảng object)
    const ipRows = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE server_id = $1', [id]);
    server.ip = ipRows.rows.map(r => ({ id: r.id, ip_address: r.ip_address }));
    // Lấy tags
    const tagRows = await pool.query(
      `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = 'server' AND tobj.object_id = $1`,
      [id]
    );
    server.tags = tagRows.rows;
    // Lấy managers
    const mgrRows = await pool.query(
      `SELECT c.id, c.name FROM server_contact sc JOIN contacts c ON sc.contact_id = c.id WHERE sc.server_id = $1`,
      [id]
    );
    server.managers = mgrRows.rows;
    // Lấy systems
    const sysRows = await pool.query(
      `SELECT sys.id, sys.name FROM server_system ss JOIN systems sys ON ss.system_id = sys.id WHERE ss.server_id = $1`,
      [id]
    );
    server.systems = sysRows.rows;
    // Lấy services
    const svRows = await pool.query(
      `SELECT s.id, s.name FROM server_services ss JOIN services s ON ss.service_id = s.id WHERE ss.server_id = $1`,
      [id]
    );
    server.services = svRows.rows;
    // Lấy agents
    const agentRows = await pool.query(
      `SELECT a.id, a.name, a.version FROM server_agents sa JOIN agents a ON sa.agent_id = a.id WHERE sa.server_id = $1`,
      [id]
    );
    server.agents = agentRows.rows;
    // Đảm bảo các trường luôn là mảng object
    server.ip = server.ip || [];
    server.tags = server.tags || [];
    server.managers = server.managers || [];
    server.systems = server.systems || [];
    server.services = server.services || [];
    server.agents = server.agents || [];
    return server;
  }
  static async countAll() {
    const res = await pool.query('SELECT COUNT(*) FROM servers');
    return parseInt(res.rows[0].count, 10);
  }
  static async findPage(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const res = await pool.query('SELECT * FROM servers ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset]);
    return res.rows;
  }

  // Lấy danh sách IP address (string) cho server
  static async getIpAddresses(serverId) {
    const result = await pool.query('SELECT ip_address FROM ip_addresses WHERE server_id = $1', [serverId]);
    return result.rows.map(r => r.ip_address);
  }

  // Lấy danh sách tags cho server (array {id, name})
  static async getTags(serverId) {
    const result = await pool.query('SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = $1 AND tobj.object_id = $2', ['server', serverId]);
    return result.rows;
  }

  // Filtered server list with pagination, search (multi fields, including tag name, system, manager, platform, etc.)
  static async filterList({ search, status, type, platform_id, location, tags, ip, manager, systems, services, os, page = 1, pageSize = 10 }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.server_id = s.id');
    joinClauses.push('LEFT JOIN server_system ss ON ss.server_id = s.id');
    joinClauses.push('LEFT JOIN systems sys ON sys.id = ss.system_id');
    joinClauses.push('LEFT JOIN server_contact sc ON sc.server_id = s.id');
    joinClauses.push('LEFT JOIN contacts c ON c.id = sc.contact_id');
    joinClauses.push('LEFT JOIN platforms p ON p.id = s.os_id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    // Thêm join cho agents/services
    joinClauses.push('LEFT JOIN server_agents sa ON sa.server_id = s.id');
    joinClauses.push('LEFT JOIN agents ag ON ag.id = sa.agent_id');
    joinClauses.push('LEFT JOIN server_services ssr ON ssr.server_id = s.id');
    joinClauses.push('LEFT JOIN services sv ON sv.id = ssr.service_id');
    // Filter by status
    if (status) {
      whereClauses.push(`s.status = $${idx}`);
      params.push(status);
      idx++;
    }
    // Filter by type
    if (type) {
      whereClauses.push(`s.type = $${idx}`);
      params.push(type);
      idx++;
    }
    // Filter by platform_id/os
    if (platform_id) {
      whereClauses.push(`s.os_id = $${idx}`);
      params.push(platform_id);
      idx++;
    }
    if (os && os.length > 0) {
      whereClauses.push(`s.os_id = ANY($${idx})`);
      params.push(os);
      idx++;
    }
    // Filter by location
    if (location) {
      whereClauses.push(`s.location ILIKE $${idx}`);
      params.push(`%${location}%`);
      idx++;
    }
    // Filter by tags (all selected tags must be present)
    if (tags && tags.length > 0) {
      whereClauses.push(`s.id IN (SELECT object_id FROM tag_object WHERE object_type = 'server' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    // Filter by ip (id)
    if (ip && ip.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM ip_addresses WHERE id = ANY($${idx}))`);
      params.push(ip);
      idx++;
    }
    // Filter by manager (contact id)
    if (manager && manager.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_contact WHERE contact_id = ANY($${idx}))`);
      params.push(manager);
      idx++;
    }
    // Filter by systems (system id)
    if (systems && systems.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_system WHERE system_id = ANY($${idx}))`);
      params.push(systems);
      idx++;
    }
    // Filter by services (service id)
    if (services && services.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_services WHERE service_id = ANY($${idx}))`);
      params.push(services);
      idx++;
    }
    // Search by multiple fields
    if (search) {
      whereClauses.push('(' + [
        `s.name ILIKE $${idx}`,
        `COALESCE(s.description, '') ILIKE $${idx}`,
        `COALESCE(ip.ip_address::text, '') ILIKE $${idx}`,
        `COALESCE(s.status::text, '') ILIKE $${idx}`,
        `COALESCE(s.location, '') ILIKE $${idx}`,
        `COALESCE(s.type, '') ILIKE $${idx}`,
        `COALESCE(sys.name, '') ILIKE $${idx}`,
        `COALESCE(c.name, '') ILIKE $${idx}`,
        `COALESCE(p.name, '') ILIKE $${idx}`,
        `COALESCE(t.name, '') ILIKE $${idx}`
      ].join(' OR ') + ')');
      params.push(`%${search}%`);
      idx++;
    }
    let sql = `SELECT s.*, 
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', sv.id, 'name', sv.name)) FILTER (WHERE sv.id IS NOT NULL), '[]') AS services,
      COALESCE(p.name, '') AS platform_name
      FROM servers s
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      GROUP BY s.id, p.name
      ORDER BY s.id
      LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, (page - 1) * pageSize);
    const result = await pool.query(sql, params);
    return result.rows;
  }

  // Count for filtered server list
  static async filterCount({ search, status, type, platform_id, location, tags, ip, manager, systems, services, os }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.server_id = s.id');
    joinClauses.push('LEFT JOIN server_system ss ON ss.server_id = s.id');
    joinClauses.push('LEFT JOIN systems sys ON sys.id = ss.system_id');
    joinClauses.push('LEFT JOIN server_contact sc ON sc.server_id = s.id');
    joinClauses.push('LEFT JOIN contacts c ON c.id = sc.contact_id');
    joinClauses.push('LEFT JOIN platforms p ON p.id = s.os_id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    if (status) {
      whereClauses.push(`s.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (type) {
      whereClauses.push(`s.type = $${idx}`);
      params.push(type);
      idx++;
    }
    if (platform_id) {
      whereClauses.push(`s.os_id = $${idx}`);
      params.push(platform_id);
      idx++;
    }
    if (os && os.length > 0) {
      whereClauses.push(`s.os_id = ANY($${idx})`);
      params.push(os);
      idx++;
    }
    if (location) {
      whereClauses.push(`s.location ILIKE $${idx}`);
      params.push(`%${location}%`);
      idx++;
    }
    if (tags && tags.length > 0) {
      whereClauses.push(`s.id IN (SELECT object_id FROM tag_object WHERE object_type = 'server' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (ip && ip.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM ip_addresses WHERE id = ANY($${idx}))`);
      params.push(ip);
      idx++;
    }
    if (manager && manager.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_contact WHERE contact_id = ANY($${idx}))`);
      params.push(manager);
      idx++;
    }
    if (systems && systems.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_system WHERE system_id = ANY($${idx}))`);
      params.push(systems);
      idx++;
    }
    if (services && services.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_services WHERE service_id = ANY($${idx}))`);
      params.push(services);
      idx++;
    }
    if (search) {
      whereClauses.push('(' + [
        `s.name ILIKE $${idx}`,
        `COALESCE(s.description, '') ILIKE $${idx}`,
        `COALESCE(ip.ip_address::text, '') ILIKE $${idx}`,
        `COALESCE(s.status::text, '') ILIKE $${idx}`,
        `COALESCE(s.location, '') ILIKE $${idx}`,
        `COALESCE(s.type, '') ILIKE $${idx}`,
        `COALESCE(sys.name, '') ILIKE $${idx}`,
        `COALESCE(c.name, '') ILIKE $${idx}`,
        `COALESCE(p.name, '') ILIKE $${idx}`,
        `COALESCE(t.name, '') ILIKE $${idx}`
      ].join(' OR ') + ')');
      params.push(`%${search}%`);
      idx++;
    }
    let sql = `SELECT COUNT(DISTINCT s.id) FROM servers s
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}`;
    const result = await pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM servers WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}

module.exports = Server;
