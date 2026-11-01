// Simple lookup lists (agents, services, ...): a name, a few text columns,
// and a usage count that blocks deletion.
//
//   const Agent = catalogModel({
//     table: 'agents', columns: ['name', 'version', 'description'], search: ['name', 'version'],
//     usageSql: 'SELECT COUNT(*) FROM server_agents u WHERE u.agent_id = t.id',
//   });
//   const agentService = catalogService(Agent, { entity: 'Agent', usedBy: 'server(s)' });
import { pool } from '../../config/config.js';
import { Where } from './db.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { hasKey } from './service.js';
import { apiHandler, handleServiceError } from './api.js';

export function catalogModel({ table, columns, search = ['name', 'description'], usageSql, text = (row) => row.name }) {
  const filterWhere = (term) => new Where().search(term, search.map((c) => `t.${c} ILIKE ?`));
  const usage = usageSql ? `(${usageSql})::int` : '0';
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0] || null;
  const all = async (sql, params) => (await pool.query(sql, params)).rows;

  return {
    async create(data) {
      return one(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        columns.map((c) => data[c] ?? null));
    },
    // Only the given columns change
    async update(id, data) {
      const keys = columns.filter((c) => hasKey(data, c));
      if (!keys.length) return this.findById(id);
      return one(`UPDATE ${table} SET ${keys.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
        [...keys.map((c) => data[c] ?? null), id]);
    },
    delete: (id) => pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]),
    findAll: () => all(`SELECT * FROM ${table} ORDER BY name`),
    findById: (id) => one(`SELECT * FROM ${table} WHERE id = $1`, [id]),
    findByIds: (ids) => (ids && ids.length ? all(`SELECT * FROM ${table} WHERE id = ANY($1::int[]) ORDER BY name`, [ids.map(Number)]) : []),
    findByNameExact: (name) => all(`SELECT * FROM ${table} WHERE LOWER(name) = LOWER($1) ORDER BY id`, [name]),
    exists: async (id) => (await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id])).rowCount > 0,
    countUsage: async (id) => (await one(`SELECT ${usage} AS n FROM ${table} t WHERE t.id = $1`, [id]))?.n || 0,
    // Page with usage_count
    async findFilteredList({ search: term = '', page = 1, pageSize = 20 } = {}) {
      const w = filterWhere(term);
      return all(`SELECT t.*, ${usage} AS usage_count FROM ${table} t WHERE ${w} ORDER BY t.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`, w.params);
    },
    async countFiltered({ search: term = '' } = {}) {
      const w = filterWhere(term);
      return parseInt((await one(`SELECT COUNT(*) FROM ${table} t WHERE ${w}`, w.params)).count, 10);
    },
    // Select2 lookup: [{id, text}]
    async select2Search({ search: term = '', limit = 20 } = {}) {
      const w = filterWhere(term);
      const rows = await all(`SELECT t.* FROM ${table} t WHERE ${w} ORDER BY t.name LIMIT ${w.param(limit)}`, w.params);
      return rows.map((row) => ({ id: row.id, text: text(row) }));
    },
  };
}

// CRUD with validation: name required and unique (case-insensitive), other
// columns trimmed (empty = null), partial update, delete refused while used.
export function catalogService(model, { entity, columns, usedBy }) {
  const notFound = () => new NotFoundError(`${entity} not found`);
  const clean = (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null));
  const others = columns.filter((c) => c !== 'name');

  async function assertNameAvailable(name, excludeId = null) {
    const matches = await model.findByNameExact(name);
    if (matches.some((m) => String(m.id) !== String(excludeId))) throw new ConflictError(`${entity} name already exists`);
  }

  return {
    async list(filter) {
      const [items, totalCount] = await Promise.all([model.findFilteredList(filter), model.countFiltered(filter)]);
      return { items, totalCount };
    },
    async get(id) {
      const row = await model.findById(id);
      if (!row) throw notFound();
      return row;
    },
    findByName: (name) => model.findByNameExact(name),
    async create(input) {
      const name = clean(input.name);
      if (!name) throw new ValidationError(`${entity} name is required`);
      await assertNameAvailable(name);
      return model.create({ name, ...Object.fromEntries(others.map((c) => [c, clean(input[c])])) });
    },
    async update(id, input) {
      if (!(await model.exists(id))) throw notFound();
      const data = Object.fromEntries(columns.filter((c) => hasKey(input, c)).map((c) => [c, clean(input[c])]));
      if (!Object.keys(data).length) throw new ValidationError('No changes made');
      if (hasKey(data, 'name')) {
        if (!data.name) throw new ValidationError(`${entity} name cannot be empty`);
        await assertNameAvailable(data.name, id);
      }
      return model.update(id, data);
    },
    async remove(id) {
      if (!(await model.exists(id))) throw notFound();
      const used = await model.countUsage(id);
      if (used) throw new ConflictError(`Cannot delete: this ${entity.toLowerCase()} is used by {count} ${usedBy}`).withParams({ count: used });
      await model.delete(id);
    },
  };
}

// REST handlers with the { success, data, message } envelope:
// list (every row), find (?name= exact), get, create, update, remove.
export function catalogApi(model, service, { entity }) {
  const handler = (fn) => apiHandler(fn, handleServiceError);
  return {
    list: handler(async (req, res) => {
      const data = await model.findAll();
      res.json({ success: true, data, count: data.length });
    }),
    find: handler(async (req, res) => {
      const name = String(req.query.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'Search term "name" is required' });
      const data = await service.findByName(name);
      res.json({ success: true, data, count: data.length });
    }),
    get: handler(async (req, res) => res.json({ success: true, data: await service.get(req.params.id) })),
    create: handler(async (req, res) => res.status(201).json({ success: true, message: `${entity} created successfully`, data: await service.create(req.body || {}) })),
    update: handler(async (req, res) => res.json({ success: true, message: `${entity} updated successfully`, data: await service.update(req.params.id, req.body || {}) })),
    remove: handler(async (req, res) => { await service.remove(req.params.id); res.json({ success: true, message: `${entity} deleted successfully` }); }),
  };
}
