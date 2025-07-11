
import { pool } from '../../config/config.js';

class Server {
  static async create({ name, os, status, location, type, description, username, client }) {
    const res = await client.query(
      'INSERT INTO servers (name, os_id, status, location, type, description, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, os, status, location, type, description || null, username]
    );
    return res.rows[0].id;
  }

  static async findAll() {
    const res = await pool.query('SELECT * FROM servers ORDER BY id');
    return res.rows;
  }

  static async findById(id) {
    const res = await pool.query(`
      SELECT s.*, p.name AS platform_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ssv.id, 'name', ssv.name)) FILTER (WHERE ssv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s
      LEFT JOIN platforms p ON p.id = s.os_id
      LEFT JOIN ip_addresses ip ON ip.server_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN server_contact sc ON sc.server_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN server_system ss ON ss.server_id = s.id
      LEFT JOIN systems sys ON sys.id = ss.system_id
      LEFT JOIN server_services sss ON sss.server_id = s.id
      LEFT JOIN services ssv ON ssv.id = sss.service_id
      LEFT JOIN server_agents sa ON sa.server_id = s.id
      LEFT JOIN agents ag ON ag.id = sa.agent_id
      WHERE s.id = $1
      GROUP BY s.id, p.name
    `, [id]);
    const server = res.rows[0];
    if (!server) return null;
    // Parse JSON fields
    server.ip = Array.isArray(server.ip) ? server.ip : JSON.parse(server.ip);
    server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
    server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
    server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
    server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
    server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
    return server;
  }

  static async update(id, { name, os, status, location, type, description, username, client }) {
    await client.query(
      'UPDATE servers SET name=$1, os_id=$2, status=$3, location=$4, type=$5, description=$6, updated_at=NOW(), updated_by=$7 WHERE id=$8',
      [name, os, status, location, type, description || null, username, id]
    );
  }

  static async remove(id, client = pool) {
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_system WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_services WHERE server_id = $1', [id]);
    await client.query('DELETE FROM ip_addresses WHERE server_id = $1', [id]);
    await client.query('DELETE FROM servers WHERE id = $1', [id]);
  }

  static async setIpAddresses(serverId, ipIds, client) {
    await client.query('UPDATE ip_addresses SET server_id = NULL, status = NULL WHERE server_id = $1', [serverId]);
    for (const ipId of ipIds) {
      await client.query('UPDATE ip_addresses SET server_id = $1, status = $2 WHERE id = $3', [serverId, 'assigned', ipId]);
    }
  }

  static async setManagers(serverId, managerList, client) {
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [serverId]);
    for (const contactId of managerList) {
      await client.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2)', [serverId, contactId]);
    }
  }

  static async setSystems(serverId, systemList, client) {
    await client.query('DELETE FROM server_system WHERE server_id = $1', [serverId]);
    for (const systemId of systemList) {
      await client.query('INSERT INTO server_system (server_id, system_id) VALUES ($1, $2)', [serverId, systemId]);
    }
  }

  static async setAgents(serverId, agentList, client) {
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [serverId]);
    for (const agentId of agentList) {
      await client.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2)', [serverId, agentId]);
    }
  }

  static async setServices(serverId, serviceList, client) {
    await client.query('DELETE FROM server_services WHERE server_id = $1', [serverId]);
    for (const serviceId of serviceList) {
      await client.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2)', [serverId, serviceId]);
    }
  }

  static async setTags(serverId, tagList, client) {
    await client.query('DELETE FROM tag_object WHERE object_type = $1 AND object_id = $2', ['server', serverId]);
    for (const tagId of tagList) {
      await client.query(
        "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'server', $2) ON CONFLICT DO NOTHING",
        [tagId, serverId]
      );
    }
  }

  static async getIpAddresses(serverId) {
    const result = await pool.query('SELECT ip_address FROM ip_addresses WHERE server_id = $1', [serverId]);
    return result.rows.map(r => r.ip_address);
  }

  static async getTags(serverId) {
    const result = await pool.query('SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = $1 AND tobj.object_id = $2', ['server', serverId]);
    return result.rows;
  }

  static async findFilteredList({ search, status, type, platform_id, location, tags, ip, manager, systems, services, os, page = 1, pageSize = 10 }) {
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
    joinClauses.push('LEFT JOIN server_agents sa ON sa.server_id = s.id');
    joinClauses.push('LEFT JOIN agents ag ON ag.id = sa.agent_id');
    joinClauses.push('LEFT JOIN server_services ssr ON ssr.server_id = s.id');
    joinClauses.push('LEFT JOIN services sv ON sv.id = ssr.service_id');
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
      whereClauses.push(`(LOWER(s.name) LIKE $${idx} OR LOWER(s.description) LIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const joins = joinClauses.join(' ');
    const offset = (page - 1) * pageSize;
    const sql = `SELECT s.* FROM servers s ${joins} ${where} GROUP BY s.id ORDER BY s.id LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, offset);
    const res = await pool.query(sql, params);
    return res.rows;
  }

  static async countFiltered({ search, status, type, platform_id, location, tags, ip, manager, systems, services, os }) {
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
    joinClauses.push('LEFT JOIN server_agents sa ON sa.server_id = s.id');
    joinClauses.push('LEFT JOIN agents ag ON ag.id = sa.agent_id');
    joinClauses.push('LEFT JOIN server_services ssr ON ssr.server_id = s.id');
    joinClauses.push('LEFT JOIN services sv ON sv.id = ssr.service_id');
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
      whereClauses.push(`(LOWER(s.name) LIKE $${idx} OR LOWER(s.description) LIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const joins = joinClauses.join(' ');
    const sql = `SELECT COUNT(DISTINCT s.id) AS count FROM servers s ${joins} ${where}`;
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  // Get full server detail, using JOINs and aggregates for optimal performance
  static async getFullDetail(id) {
    const res = await pool.query(`
      SELECT s.*, p.name AS platform_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ssv.id, 'name', ssv.name, 'description', ssv.description)) FILTER (WHERE ssv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version, 'description', ag.description)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s
      LEFT JOIN platforms p ON p.id = s.os_id
      LEFT JOIN ip_addresses ip ON ip.server_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN server_contact sc ON sc.server_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN server_system ss ON ss.server_id = s.id
      LEFT JOIN systems sys ON sys.id = ss.system_id
      LEFT JOIN server_services sss ON sss.server_id = s.id
      LEFT JOIN services ssv ON ssv.id = sss.service_id
      LEFT JOIN server_agents sa ON sa.server_id = s.id
      LEFT JOIN agents ag ON ag.id = sa.agent_id
      WHERE s.id = $1
      GROUP BY s.id, p.name
    `, [id]);
    const server = res.rows[0];
    if (!server) return null;
    // Parse JSON fields
    server.ip = Array.isArray(server.ip) ? server.ip : JSON.parse(server.ip);
    server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
    server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
    server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
    server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
    server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
    return server;
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM servers WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  // For select2 AJAX: get servers by search (id, name)
  static async select2Search({ search = '', limit = 20 }) {
    let sql = 'SELECT id, name FROM servers';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    // Select2 expects: { results: [ { id, text } ] }
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

}

export default Server;
