
import { pool } from '../../config/config.js';


class Subnet {
  // Get all subnets
  static async findAll() {
    const result = await pool.query('SELECT * FROM subnets ORDER BY updated_at DESC');
    return result.rows;
  }

  // Get a subnet by ID (with tags)
  static async findById(id) {
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [id]
    );
    return result.rows[0];
  }

  // Create a new subnet (only fields in subnets table)
  static async create({ address, description, updated_by = '' }, client = pool) {
    const result = await client.query(
      'INSERT INTO subnets (address, description, updated_by) VALUES ($1, $2, $3) RETURNING *',
      [address, description, updated_by]
    );
    return result.rows[0];
  }

  /**
   * Set all tags for a subnet (remove all old, add new)
   * @param {number} subnetId
   * @param {Array<number>} tagIds
   * @param {object} [client=pool]
   * @returns {Promise<void>}
   */
  static async setTags(subnetId, tagIds, client = pool) {
    await client.query("DELETE FROM tag_object WHERE object_type = 'subnet' AND object_id = $1", [subnetId]);
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const values = tagIds.map((tagId, idx) => `($1, $${idx + 2}, 'subnet')`).join(',');
      await client.query(
        `INSERT INTO tag_object (object_id, tag_id, object_type) VALUES ${values}`,
        [subnetId, ...tagIds]
      );
    }
  }

  // Update subnet description by ID (transaction client optional)
  static async update(id, { description, updated_by = '' }, client = pool) {
    await client.query(
      'UPDATE subnets SET description = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [description, updated_by, id]
    );
  }



  // Count all subnets
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM subnets');
    return parseInt(result.rows[0].count, 10);
  }

  // Get a page of subnets
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  // Get filtered list of subnets (with pagination, search, tags)
  static async findFilteredList({ search, tags, page = 1, pageSize = 10 }) {
    let params = [];
    let whereClauses = [];
    let idx = 1;
    
    // Filter by tags (all selected tags must be present)
    if (tags && tags.length > 0) {
      whereClauses.push(`s.id IN (SELECT object_id FROM tag_object WHERE object_type = 'subnet' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    
    // Search by subnet address or description
    if (search && search.trim() !== '') {
      if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(search)) {
        // If search is a valid subnet/IP format, use network operators
        whereClauses.push(`s.address >>= $${idx}`);
        params.push(search);
        idx++;
      } else {
        // Regular text search
        whereClauses.push(`(s.address::text ILIKE $${idx} OR s.description ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }
    }
    
    const offset = (page - 1) * pageSize;
    const whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    let orderBy = 'ORDER BY s.updated_at DESC';
    if (search && /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(search) && (!tags || tags.length === 0)) {
      orderBy = 'ORDER BY masklen(s.address) DESC';
    }
    
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       ${whereClause}
       GROUP BY s.id
       ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset]
    );
    return result.rows;
  }

  // Get count for filtered subnet list (search, tags)
  static async countFiltered({ search, tags }) {
    let params = [];
    let whereClauses = [];
    let idx = 1;
    
    // Filter by tags (all selected tags must be present)
    if (tags && tags.length > 0) {
      whereClauses.push(`s.id IN (SELECT object_id FROM tag_object WHERE object_type = 'subnet' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    
    // Search by subnet address or description
    if (search && search.trim() !== '') {
      if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(search)) {
        // If search is a valid subnet/IP format, use network operators
        whereClauses.push(`s.address >>= $${idx}`);
        params.push(search);
        idx++;
      } else {
        // Regular text search
        whereClauses.push(`(s.address::text ILIKE $${idx} OR s.description ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }
    }
    
    const whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const result = await pool.query(
      `SELECT COUNT(DISTINCT s.id) AS count
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       ${whereClause}`,
      params
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Delete subnet and its tag links (transaction client optional)
  static async delete(id, client = pool) {
    await client.query("DELETE FROM tag_object WHERE object_type = 'subnet' AND object_id = $1", [id]);
    await client.query('DELETE FROM subnets WHERE id = $1', [id]);
  }

  // Find subnet by address (for duplicate check)
  static async findByAddress(address) {
    const result = await pool.query('SELECT * FROM subnets WHERE address = $1', [address]);
    return result.rows[0];
  }

  // Find the smallest subnet containing a given IP or subnet
  static async findContainingSubnet(ipOrSubnet) {
    // This query finds all subnets where the address contains the input, and returns the smallest (most specific) one
    const result = await pool.query(
      `SELECT * FROM subnets WHERE address >>= $1 ORDER BY masklen(address) DESC LIMIT 1`,
      [ipOrSubnet]
    );
    return result.rows[0] || null;
  }

  // Build a tree structure from a flat list of subnets (for hierarchical display)
  static buildSubnetTree(subnets) {
    // Sort subnets by masklen descending (most specific first)
    const sorted = [...subnets].sort((a, b) => {
      const maskA = parseInt(String(a.address).split('/')[1] || '0', 10);
      const maskB = parseInt(String(b.address).split('/')[1] || '0', 10);
      return maskB - maskA;
    });
    // Add children array to each subnet
    for (const s of sorted) s.children = [];
    // Map for quick lookup
    const idMap = new Map(sorted.map(s => [s.id, s]));
    // Build parent-child relationships
    for (const child of sorted) {
      for (const parent of sorted) {
        if (parent === child) continue;
        // Parent must be less specific (smaller masklen)
        const maskParent = parseInt(String(parent.address).split('/')[1] || '0', 10);
        const maskChild = parseInt(String(child.address).split('/')[1] || '0', 10);
        if (maskParent < maskChild) {
          // Check if parent contains child (Postgres operator logic)
          // Use string comparison for IPv4, or use pg for more robust
          if (Subnet.addressContains(parent.address, child.address)) {
            parent.children.push(child);
            child._hasParent = true;
            break; // Only assign to the most specific parent
          }
        }
      }
    }
    // Return only root subnets (those without parent)
    return sorted.filter(s => !s._hasParent);
  }

  // Helper: check if subnetA contains subnetB (IPv4 only, simple logic)
  static addressContains(subnetA, subnetB) {
    // Use Postgres inet/cidr logic: subnetA >>= subnetB
    // For simplicity, use pg-inet/cidr or do basic check here
    // This is a simple implementation for IPv4
    const [ipA, maskA] = String(subnetA).split('/');
    const [ipB, maskB] = String(subnetB).split('/');
    if (!maskA || !maskB) return false;
    const ipToInt = ip => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0);
    const intA = ipToInt(ipA);
    const intB = ipToInt(ipB);
    const maskLenA = parseInt(maskA, 10);
    const maskAInt = maskLenA === 0 ? 0 : ~((1 << (32 - maskLenA)) - 1) >>> 0;
    return (intA & maskAInt) === (intB & maskAInt);
  }
}

export default Subnet;
