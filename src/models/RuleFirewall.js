// src/models/RuleFirewall.js
import { pool } from '../../config/config.js';



class RuleFirewall {
  // ===== CRUD METHODS =====
  static async create(data, client) {
    // Accept external client for transaction, fallback to pool
    const executor = client || pool;
    let shouldManageTransaction = !client;
    // Assume data is already normalized in controller
    // Validate required fields
    if (!data.rulename || !data.src || !data.dst || !data.action) {
      throw new Error('Missing required fields: Rule Name, Source, Destination, Action');
    }
    if (shouldManageTransaction) {
      const transactionClient = await pool.connect();
      try {
        await transactionClient.query('BEGIN');
        const ruleId = await RuleFirewall.create(data, transactionClient);
        await transactionClient.query('COMMIT');
        return { id: ruleId };
      } catch (err) {
        await transactionClient.query('ROLLBACK');
        throw err;
      } finally {
        transactionClient.release();
      }
    }
    // Insert rule
    const insertSql = `INSERT INTO rulefirewall
      (rulename, firewall_name, src_zone, src, src_detail, dst_zone, dst, dst_detail, services, application, url, action, ou_id, status, violation_type, violation_detail, solution_proposal, solution_confirm, description, audit_batch, work_order, created_at, updated_at, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW(),$22) RETURNING id`;
    const values = [
      data.rulename, data.firewall_name, data.src_zone, data.src, data.src_detail, data.dst_zone, data.dst, data.dst_detail,
      data.services, data.application, data.url, data.action, data.ou_id || null, data.status || null,
      data.violation_type, data.violation_detail, data.solution_proposal, data.solution_confirm, data.description,
      data.audit_batch || null, data.work_order || null, data.updated_by || null
    ];
    const result = await executor.query(insertSql, values);
    const ruleId = result.rows[0].id;
    return ruleId;
  }


  static async findById(id) {
    const result = await pool.query(
      `SELECT rf.*, u.name AS ou_name FROM rulefirewall rf
       LEFT JOIN units u ON rf.ou_id = u.id
       WHERE rf.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const rule = result.rows[0];
    // Fetch contacts and tags
    const contactRows = await pool.query(
      `SELECT c.id, c.name, c.email FROM rulefirewall_contact rc JOIN contacts c ON rc.contact_id = c.id WHERE rc.rule_id = $1 ORDER BY c.name`,
      [rule.id]
    );
    rule.contacts = contactRows.rows;
    const tagRows = await pool.query(
      `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_id = $1 AND tobj.object_type = 'rulefirewall' ORDER BY t.name`,
      [rule.id]
    );
    rule.tagNames = tagRows.rows.map(t => t.name);
    rule.tags = tagRows.rows;
    return rule;
  }

  static async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM rulefirewall WHERE id = ANY($1)', [ids]);
    return result.rows;
  }

  static async update(id, data, client) {
    // Accept external client for transaction, fallback to pool
    const executor = client || pool;
    let shouldManageTransaction = !client;
    // Data is already normalized in controller
    // Validate required fields
    if (!data.rulename || !data.src || !data.dst || !data.action) {
      throw new Error('Missing required fields: Rule Name, Source, Destination, Action');
    }
    if (shouldManageTransaction) {
      const transactionClient = await pool.connect();
      try {
        await transactionClient.query('BEGIN');
        const result = await RuleFirewall.update(id, data, transactionClient);
        await transactionClient.query('COMMIT');
        return result;
      } catch (err) {
        await transactionClient.query('ROLLBACK');
        throw err;
      } finally {
        transactionClient.release();
      }
    }
    // Update rule
    const updateSql = `UPDATE rulefirewall SET
      rulename=$1, firewall_name=$2, src_zone=$3, src=$4, src_detail=$5, dst_zone=$6, dst=$7, dst_detail=$8,
      services=$9, application=$10, url=$11, action=$12, ou_id=$13, status=$14, violation_type=$15,
      violation_detail=$16, solution_proposal=$17, solution_confirm=$18, description=$19, audit_batch=$20, work_order=$21,
      updated_at=NOW(), updated_by=$22
      WHERE id=$23 RETURNING *`;
    const values = [
      data.rulename, data.firewall_name, data.src_zone, data.src, data.src_detail, data.dst_zone, data.dst, data.dst_detail,
      data.services, data.application, data.url, data.action, data.ou_id || null, data.status || null,
      data.violation_type, data.violation_detail, data.solution_proposal, data.solution_confirm, data.description,
      data.audit_batch || null, data.work_order || null, data.updated_by || null, id
    ];
    const result = await executor.query(updateSql, values);
    // ...existing code...
    return result.rows[0];
  }

  static async remove(id, client) {
    // Accept external client for transaction, fallback to pool
    const executor = client || pool;
    let shouldManageTransaction = !client;
    if (shouldManageTransaction) {
      const transactionClient = await pool.connect();
      try {
        await transactionClient.query('BEGIN');
        await RuleFirewall.remove(id, transactionClient);
        await transactionClient.query('COMMIT');
      } catch (err) {
        await transactionClient.query('ROLLBACK');
        throw err;
      } finally {
        transactionClient.release();
      }
      return;
    }
    // Remove all tag links for this rule
    await executor.query("DELETE FROM tag_object WHERE object_type = 'rulefirewall' AND object_id = $1", [id]);
    // Remove all contact links for this rule
    await executor.query('DELETE FROM rulefirewall_contact WHERE rule_id = $1', [id]);
    // Delete the rule itself
    await executor.query('DELETE FROM rulefirewall WHERE id = $1', [id]);
  }

  // ===== FILTERED LIST & PAGINATION =====
  static async findFilteredList({ search = '', page = 1, pageSize = 10, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch }) {
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    
    let whereClauses = [];
    let params = [];
    let paramIdx = 1;
    
    // Search parameter
    if (search) {
      whereClauses.push(`(
        rf.rulename ILIKE $${paramIdx} OR
        rf.firewall_name ILIKE $${paramIdx} OR
        rf.src_zone ILIKE $${paramIdx} OR
        rf.src ILIKE $${paramIdx} OR
        rf.src_detail ILIKE $${paramIdx} OR
        rf.dst_zone ILIKE $${paramIdx} OR
        rf.dst ILIKE $${paramIdx} OR
        rf.dst_detail ILIKE $${paramIdx} OR
        rf.services ILIKE $${paramIdx} OR
        rf.application ILIKE $${paramIdx} OR
        rf.url ILIKE $${paramIdx} OR
        rf.action ILIKE $${paramIdx} OR
        rf.violation_type ILIKE $${paramIdx} OR
        rf.violation_detail ILIKE $${paramIdx} OR
        rf.solution_proposal ILIKE $${paramIdx} OR
        rf.solution_confirm ILIKE $${paramIdx} OR
        rf.status ILIKE $${paramIdx} OR
        rf.description ILIKE $${paramIdx} OR
        rf.updated_by ILIKE $${paramIdx} OR
        t.name ILIKE $${paramIdx} OR
        c.name ILIKE $${paramIdx} OR
        u.name ILIKE $${paramIdx}
      )`);
      params.push(q);
      paramIdx++;
    }
    
    // Filter by OU
    if (ou_id) {
      whereClauses.push(`rf.ou_id = $${paramIdx}`);
      params.push(ou_id);
      paramIdx++;
    }
    
    // Filter by violation_type
    if (violation_type) {
      whereClauses.push(`rf.violation_type = $${paramIdx}`);
      params.push(violation_type);
      paramIdx++;
    }
    
    // Filter by status
    if (status) {
      whereClauses.push(`rf.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    
    // Filter by firewall_name
    if (firewall_name) {
      whereClauses.push(`rf.firewall_name = $${paramIdx}`);
      params.push(firewall_name);
      paramIdx++;
    }
    
    // Filter by tags (must have ALL selected tags)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      whereClauses.push(`rf.id IN (
        SELECT tobj.object_id
        FROM tag_object tobj
        WHERE tobj.object_type = 'rulefirewall' AND tobj.tag_id = ANY($${paramIdx})
        GROUP BY tobj.object_id
        HAVING COUNT(DISTINCT tobj.tag_id) = $${paramIdx + 1}
      )`);
      params.push(tags.map(Number));
      params.push(tags.length);
      paramIdx += 2;
    }
    
    // Filter by contacts (must have ALL selected contacts)
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      whereClauses.push(`rf.id IN (
        SELECT rc.rule_id
        FROM rulefirewall_contact rc
        WHERE rc.contact_id = ANY($${paramIdx})
        GROUP BY rc.rule_id
        HAVING COUNT(DISTINCT rc.contact_id) = $${paramIdx + 1}
      )`);
      params.push(contacts.map(Number));
      params.push(contacts.length);
      paramIdx += 2;
    }
    
    // Filter by audit_batch (comma-separated, partial match for any batch)
    if (typeof audit_batch === 'string' && audit_batch.length > 0) {
      const batches = audit_batch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      if (batches.length > 0) {
        const batchClauses = batches.map((batch, i) => `rf.audit_batch ILIKE $${paramIdx + i}`);
        whereClauses.push('(' + batchClauses.join(' OR ') + ')');
        params.push(...batches.map(b => `%${b}%`));
        paramIdx += batches.length;
      }
    }
    
    const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    // Add pagination params
    params.push(pageSize, offset);
    
    const result = await pool.query(`
      SELECT rf.*,
        u.name AS ou_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts
      FROM rulefirewall rf
      LEFT JOIN units u ON rf.ou_id = u.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'rulefirewall' AND tobj.object_id = rf.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN rulefirewall_contact rfc ON rfc.rule_id = rf.id
      LEFT JOIN contacts c ON c.id = rfc.contact_id
      ${where}
      GROUP BY rf.id, u.name
      ORDER BY rf.id ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, params);
    
    // Process results to match expected format
    const rules = result.rows.map(rule => ({
      ...rule,
      tagNames: rule.tags.map(tag => tag.name),
      tags: rule.tags // Keep full tag objects
    }));
    
    return rules;
  }

  static async countFiltered({ search = '', ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch }) {
    const q = `%${search}%`;
    
    let whereClauses = [];
    let params = [];
    let paramIdx = 1;
    
    // Search parameter
    if (search) {
      whereClauses.push(`(
        rf.rulename ILIKE $${paramIdx} OR
        rf.firewall_name ILIKE $${paramIdx} OR
        rf.src_zone ILIKE $${paramIdx} OR
        rf.src ILIKE $${paramIdx} OR
        rf.src_detail ILIKE $${paramIdx} OR
        rf.dst_zone ILIKE $${paramIdx} OR
        rf.dst ILIKE $${paramIdx} OR
        rf.dst_detail ILIKE $${paramIdx} OR
        rf.services ILIKE $${paramIdx} OR
        rf.application ILIKE $${paramIdx} OR
        rf.url ILIKE $${paramIdx} OR
        rf.action ILIKE $${paramIdx} OR
        rf.violation_type ILIKE $${paramIdx} OR
        rf.violation_detail ILIKE $${paramIdx} OR
        rf.solution_proposal ILIKE $${paramIdx} OR
        rf.solution_confirm ILIKE $${paramIdx} OR
        rf.status ILIKE $${paramIdx} OR
        rf.description ILIKE $${paramIdx} OR
        rf.updated_by ILIKE $${paramIdx} OR
        t.name ILIKE $${paramIdx} OR
        c.name ILIKE $${paramIdx} OR
        u.name ILIKE $${paramIdx}
      )`);
      params.push(q);
      paramIdx++;
    }
    
    // Filter by OU
    if (ou_id) {
      whereClauses.push(`rf.ou_id = $${paramIdx}`);
      params.push(ou_id);
      paramIdx++;
    }
    
    // Filter by violation_type
    if (violation_type) {
      whereClauses.push(`rf.violation_type = $${paramIdx}`);
      params.push(violation_type);
      paramIdx++;
    }
    
    // Filter by status
    if (status) {
      whereClauses.push(`rf.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    
    // Filter by firewall_name
    if (firewall_name) {
      whereClauses.push(`rf.firewall_name = $${paramIdx}`);
      params.push(firewall_name);
      paramIdx++;
    }
    
    // Filter by tags (must have ALL selected tags)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      whereClauses.push(`rf.id IN (
        SELECT tobj.object_id
        FROM tag_object tobj
        WHERE tobj.object_type = 'rulefirewall' AND tobj.tag_id = ANY($${paramIdx})
        GROUP BY tobj.object_id
        HAVING COUNT(DISTINCT tobj.tag_id) = $${paramIdx + 1}
      )`);
      params.push(tags.map(Number));
      params.push(tags.length);
      paramIdx += 2;
    }
    
    // Filter by contacts (must have ALL selected contacts)
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      whereClauses.push(`rf.id IN (
        SELECT rc.rule_id
        FROM rulefirewall_contact rc
        WHERE rc.contact_id = ANY($${paramIdx})
        GROUP BY rc.rule_id
        HAVING COUNT(DISTINCT rc.contact_id) = $${paramIdx + 1}
      )`);
      params.push(contacts.map(Number));
      params.push(contacts.length);
      paramIdx += 2;
    }
    
    // Filter by audit_batch (comma-separated, partial match for any batch)
    if (typeof audit_batch === 'string' && audit_batch.length > 0) {
      const batches = audit_batch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      if (batches.length > 0) {
        const batchClauses = batches.map((batch, i) => `rf.audit_batch ILIKE $${paramIdx + i}`);
        whereClauses.push('(' + batchClauses.join(' OR ') + ')');
        params.push(...batches.map(b => `%${b}%`));
        paramIdx += batches.length;
      }
    }
    
    const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const result = await pool.query(`
      SELECT COUNT(DISTINCT rf.id) AS count
      FROM rulefirewall rf
      LEFT JOIN units u ON rf.ou_id = u.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'rulefirewall' AND tobj.object_id = rf.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN rulefirewall_contact rfc ON rfc.rule_id = rf.id
      LEFT JOIN contacts c ON c.id = rfc.contact_id
      ${where}
    `, params);
    
    return parseInt(result.rows[0].count, 10);
  }

  // ===== SELECT2 AJAX SEARCH (for dropdowns) =====
  static async select2Search({ search = '', limit = 20 }) {
    const q = `%${search}%`;
    const result = await pool.query(
      `SELECT id, rulename, firewall_name FROM rulefirewall
       WHERE rulename ILIKE $1 OR firewall_name ILIKE $1 OR src ILIKE $1 OR dst ILIKE $1
       ORDER BY rulename ASC
       LIMIT $2`,
      [q, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      text: row.rulename ? `${row.rulename} (${row.firewall_name || 'Unknown'})` : `Rule #${row.id}`
    }));
  }

  // ===== RELATIONSHIP/UTILITY GETTERS =====
  static async getContactsByRuleId(ruleId) {
    const result = await pool.query('SELECT contact_id FROM rulefirewall_contact WHERE rule_id = $1', [ruleId]);
    return result.rows.map(row => row.contact_id);
  }

  static async getTagIds(ruleId) {
    const result = await pool.query(
      "SELECT tag_id FROM tag_object WHERE object_type = 'rulefirewall' AND object_id = $1",
      [ruleId]
    );
    return result.rows.map(row => row.tag_id);
  }

  // ===== RELATIONSHIP/UTILITY METHODS =====
  static async setContacts(ruleId, contactIds, client) {
    const executor = client || pool;
    await executor.query('DELETE FROM rulefirewall_contact WHERE rule_id = $1', [ruleId]);
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      for (const contactId of contactIds) {
        await executor.query('INSERT INTO rulefirewall_contact (rule_id, contact_id) VALUES ($1, $2)', [ruleId, contactId]);
      }
    }
  }

  static async addContacts(ruleId, contactIds, client) {
    const executor = client || pool;
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      for (const contactId of contactIds) {
        await executor.query('INSERT INTO rulefirewall_contact (rule_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ruleId, contactId]);
      }
    }
  }

  static async setTags(ruleId, tagIds, client) {
    const executor = client || pool;
    await executor.query("DELETE FROM tag_object WHERE object_type = 'rulefirewall' AND object_id = $1", [ruleId]);
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await executor.query("INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('rulefirewall', $1, $2)", [ruleId, tagId]);
      }
    }
  }

  static async addTags(ruleId, tagIds, client) {
    const executor = client || pool;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await executor.query("INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('rulefirewall', $1, $2) ON CONFLICT DO NOTHING", [ruleId, tagId]);
      }
    }
  }

  // ===== EXISTENCE CHECKER =====
  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM rulefirewall WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  // ===== BATCH OPERATIONS =====
  static async updateManyWorkOrder(ids, work_order, updated_by) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
    const sql = `UPDATE rulefirewall SET work_order = $1, updated_by = $2, updated_at = NOW() WHERE id IN (${placeholders})`;
    const result = await pool.query(sql, [work_order, updated_by, ...ids]);
    return result.rowCount;
  }

  // ===== LEGACY COMPATIBILITY METHOD =====
  // Keep this method for backward compatibility with existing controller code
  static async findAll({ search = '', page = 1, pageSize = 10, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch }) {
    const rules = await this.findFilteredList({ search, page, pageSize, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch });
    const totalCount = await this.countFiltered({ search, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch });
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    
    return {
      rules,
      totalCount,
      totalPages
    };
  }

  // Find rule by firewall name, rule name and audit batch combination
  static async findByFirewallRuleNameAndAuditBatch(firewallName, ruleName, auditBatch, client = null) {
    const shouldRelease = !client;
    if (!client) {
      client = await pool.connect();
    }

    try {
      const query = `
        SELECT * FROM rulefirewall 
        WHERE firewall_name = $1 AND rulename = $2 AND audit_batch = $3
        LIMIT 1
      `;
      const result = await client.query(query, [firewallName, ruleName, auditBatch]);
      return result.rows[0] || null;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  // ===== LEGACY ALIAS METHODS =====
  // These provide backward compatibility with the old method names
  static async delete(id, client) {
    return this.remove(id, client);
  }
}

export default RuleFirewall;
