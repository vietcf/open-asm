// src/models/RuleFirewall.js
const { pool } = require('../../config/config');

class RuleFirewall {
  static async findAll({ search = '', page = 1, pageSize = 10, ou_id, contacts, tags, violation_type, status, firewall_name }) {
    let whereClauses = [];
    let params = [];
    let paramIdx = 1;
    if (search) {
      // Search trên tất cả các trường dạng text/string của bảng rulefirewall
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
        rf.updated_by ILIKE $${paramIdx}
      )`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (ou_id) {
      whereClauses.push(`rf.ou_id = $${paramIdx}`);
      params.push(ou_id);
      paramIdx++;
    }
    if (violation_type) {
      whereClauses.push(`rf.violation_type = $${paramIdx}`);
      params.push(violation_type);
      paramIdx++;
    }
    if (status) {
      whereClauses.push(`rf.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    // Add firewall_name filter
    if (firewall_name) {
      whereClauses.push(`rf.firewall_name = $${paramIdx}`);
      params.push(firewall_name);
      paramIdx++;
    }
    // Filter by tags (must have ALL selected tags)
    let tagJoin = '';
    if (tags && Array.isArray(tags) && tags.length > 0) {
      tagJoin = `JOIN (
        SELECT tobj.object_id
        FROM tag_object tobj
        WHERE tobj.object_type = 'rulefirewall' AND tobj.tag_id = ANY($${paramIdx})
        GROUP BY tobj.object_id
        HAVING COUNT(DISTINCT tobj.tag_id) = $${paramIdx + 1}
      ) tagf ON tagf.object_id = rf.id`;
      params.push(tags.map(Number));
      params.push(tags.length);
      paramIdx += 2;
    }
    // Filter by contacts (must have ALL selected contacts)
    let contactJoin = '';
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      contactJoin = `JOIN (
        SELECT rc.rule_id
        FROM rulefirewall_contact rc
        WHERE rc.contact_id = ANY($${paramIdx})
        GROUP BY rc.rule_id
        HAVING COUNT(DISTINCT rc.contact_id) = $${paramIdx + 1}
      ) cf ON cf.rule_id = rf.id`;
      params.push(contacts.map(Number));
      params.push(contacts.length);
      paramIdx += 2;
    }
    let where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    // Count query
    const countSql = `SELECT COUNT(*) FROM rulefirewall rf
      LEFT JOIN units u ON rf.ou_id = u.id
      ${tagJoin}
      ${contactJoin}
      ${where}`;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    // Add pagination params
    const paramsWithPaging = params.concat([pageSize, offset]);
    // Main query
    const sql = `SELECT rf.*, u.name AS ou_name, rf.work_order
       FROM rulefirewall rf
       LEFT JOIN units u ON rf.ou_id = u.id
       ${tagJoin}
       ${contactJoin}
       ${where} ORDER BY rf.id ASC LIMIT $${paramsWithPaging.length - 1} OFFSET $${paramsWithPaging.length}`;
    const ruleResult = await pool.query(sql, paramsWithPaging);
    const rules = ruleResult.rows;
    // Fetch contacts and tags for each rule
    for (const rule of rules) {
      // Contacts
      const contactRows = await pool.query(
        `SELECT c.id, c.name, c.email FROM rulefirewall_contact rc JOIN contacts c ON rc.contact_id = c.id WHERE rc.rule_id = $1 ORDER BY c.name`,
        [rule.id]
      );
      rule.contacts = contactRows.rows; // Array of {id, name, email}
      // Tags
      const tagRows = await pool.query(
        `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_id = $1 AND tobj.object_type = 'rulefirewall' ORDER BY t.name`,
        [rule.id]
      );
      rule.tagNames = tagRows.rows.map(t => t.name);
      rule.tags = tagRows.rows; // full tag objects if needed
    }
    return {
      rules,
      totalCount,
      totalPages
    };
  }
  static async create(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Normalize & trim all string fields
      const fields = [
        'rulename', 'firewall_name', 'src_zone', 'src', 'src_detail', 'dst_zone', 'dst', 'dst_detail',
        'services', 'application', 'url', 'action', 'status', 'violation_type',
        'violation_detail', 'solution_proposal', 'solution_confirm', 'description', 'work_order'
      ];
      for (const f of fields) {
        if (typeof data[f] === 'string') data[f] = data[f].trim();
      }
      // Validate required fields
      if (!data.rulename || !data.src || !data.dst || !data.action) {
        throw new Error('Missing required fields: Rule Name, Source, Destination, Action');
      }
      // Insert rule
      const insertSql = `INSERT INTO rulefirewall
        (rulename, firewall_name, src_zone, src, src_detail, dst_zone, dst, dst_detail, services, application, url, action, ou_id, status, violation_type, violation_detail, solution_proposal, solution_confirm, description, work_order, created_at, updated_at, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW(),$21) RETURNING id`;
      const values = [
        data.rulename, data.firewall_name, data.src_zone, data.src, data.src_detail, data.dst_zone, data.dst, data.dst_detail,
        data.services, data.application, data.url, data.action, data.ou_id || null, data.status || null,
        data.violation_type, data.violation_detail, data.solution_proposal, data.solution_confirm, data.description, data.work_order || null, data.updated_by || null
      ];
      const result = await client.query(insertSql, values);
      const ruleId = result.rows[0].id;
      // Insert contacts (many-to-many)
      if (Array.isArray(data.contacts) && data.contacts.length > 0) {
        for (const cid of data.contacts) {
          await client.query('INSERT INTO rulefirewall_contact(rule_id, contact_id) VALUES ($1, $2)', [ruleId, cid]);
        }
      }
      // Insert tags (many-to-many)
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tid of data.tags) {
          await client.query('INSERT INTO tag_object(tag_id, object_id, object_type) VALUES ($1, $2, $3)', [tid, ruleId, 'rulefirewall']);
        }
      }
      await client.query('COMMIT');
      return ruleId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  static async update(id, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Normalize & trim all string fields
      const fields = [
        'rulename', 'firewall_name', 'src_zone', 'src', 'src_detail', 'dst_zone', 'dst', 'dst_detail',
        'services', 'application', 'url', 'action', 'status', 'violation_type',
        'violation_detail', 'solution_proposal', 'solution_confirm', 'description', 'work_order'
      ];
      for (const f of fields) {
        if (typeof data[f] === 'string') data[f] = data[f].trim();
      }
      // Validate required fields
      if (!data.rulename || !data.src || !data.dst || !data.action) {
        throw new Error('Missing required fields: Rule Name, Source, Destination, Action');
      }
      // Update rule
      const updateSql = `UPDATE rulefirewall SET
        rulename=$1, firewall_name=$2, src_zone=$3, src=$4, src_detail=$5, dst_zone=$6, dst=$7, dst_detail=$8,
        services=$9, application=$10, url=$11, action=$12, ou_id=$13, status=$14, violation_type=$15,
        violation_detail=$16, solution_proposal=$17, solution_confirm=$18, description=$19, work_order=$20,
        updated_at=NOW(), updated_by=$21
        WHERE id=$22`;
      const values = [
        data.rulename, data.firewall_name, data.src_zone, data.src, data.src_detail, data.dst_zone, data.dst, data.dst_detail,
        data.services, data.application, data.url, data.action, data.ou_id || null, data.status || null,
        data.violation_type, data.violation_detail, data.solution_proposal, data.solution_confirm, data.description, data.work_order || null, data.updated_by || null, id
      ];
      await client.query(updateSql, values);
      // Update contacts (remove all, then add new)
      await client.query('DELETE FROM rulefirewall_contact WHERE rule_id = $1', [id]);
      if (Array.isArray(data.contacts) && data.contacts.length > 0) {
        for (const cid of data.contacts) {
          await client.query('INSERT INTO rulefirewall_contact(rule_id, contact_id) VALUES ($1, $2)', [id, cid]);
        }
      }
      // Update tags (remove all, then add new)
      await client.query("DELETE FROM tag_object WHERE object_id = $1 AND object_type = 'rulefirewall'", [id]);
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tid of data.tags) {
          await client.query('INSERT INTO tag_object(tag_id, object_id, object_type) VALUES ($1, $2, $3)', [tid, id, 'rulefirewall']);
        }
      }
      await client.query('COMMIT');
      return id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  static async delete(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Remove all tag links for this rule
      await client.query("DELETE FROM tag_object WHERE object_type = 'rulefirewall' AND object_id = $1", [id]);
      // Remove all contact links for this rule
      await client.query('DELETE FROM rulefirewall_contact WHERE rule_id = $1', [id]);
      // Delete the rule itself
      await client.query('DELETE FROM rulefirewall WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  // Có thể bổ sung thêm các method delete ở đây

  // Batch update work_order for multiple rules
  static async updateManyWorkOrder(ids, work_order, updated_by) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
    const sql = `UPDATE rulefirewall SET work_order = $1, updated_by = $2, updated_at = NOW() WHERE id IN (${placeholders})`;
    const result = await pool.query(sql, [work_order, updated_by, ...ids]);
    return result.rowCount; // Return number of updated rows
  }
}

module.exports = RuleFirewall;
