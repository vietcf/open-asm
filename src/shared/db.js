// SQL building blocks shared by the models.
import { pool } from '../../config/config.js';

export const NONE = '__none__'; // filter value meaning "not set"

// The client of the surrounding transaction, or the pool.
export const db = (client) => client || pool;

// WHERE clause with numbered parameters:
//   const w = new Where();
//   w.add(`s.level = ${w.param(level)}`);
//   pool.query(`SELECT ... WHERE ${w}`, w.params)
export class Where {
  constructor() { this.clauses = []; this.params = []; }
  param(value) { this.params.push(value); return `$${this.params.length}`; }
  add(clause) { if (clause) this.clauses.push(clause); return this; }
  // ILIKE '%term%' over several expressions (no-op for an empty term)
  search(term, expressions) {
    if (!term) return this;
    const p = this.param(`%${term}%`);
    return this.add(`(${expressions.map(e => e.replace(/\?/g, p)).join(' OR ')})`);
  }
  // Multi-select filter where NONE ("not set") may be picked along with real values:
  //   w.anyOf(filterContacts, ids => `EXISTS (... contact_id = ANY(${w.param(ids.map(Number))}))`, 'NOT EXISTS (...)')
  anyOf(values, matchSql, noneSql) {
    const list = (values || []).map(String);
    if (!list.length) return this;
    const real = list.filter(v => v !== NONE);
    const parts = [];
    if (list.includes(NONE)) parts.push(noneSql);
    if (real.length) parts.push(matchSql(real));
    return this.add(parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0]);
  }
  toString() { return this.clauses.length ? this.clauses.join(' AND ') : 'TRUE'; }
}

// Replace the rows of a link table for one owner:
//   replaceLinks(client, 'system_contact', 'system_id', id, 'contact_id', [1, 2])
export async function replaceLinks(client, table, ownerColumn, ownerId, otherColumn, ids) {
  const ex = db(client);
  await ex.query(`DELETE FROM ${table} WHERE ${ownerColumn} = $1`, [ownerId]);
  if (ids && ids.length) {
    await ex.query(
      `INSERT INTO ${table} (${ownerColumn}, ${otherColumn}) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
      [ownerId, [...new Set(ids.map(Number))]]
    );
  }
}

// Tags are polymorphic (tag_object.object_type / object_id).
export async function replaceTags(client, objectType, objectId, tagIds) {
  const ex = db(client);
  await ex.query('DELETE FROM tag_object WHERE object_type = $1 AND object_id = $2', [objectType, objectId]);
  if (tagIds && tagIds.length) {
    await ex.query(
      'INSERT INTO tag_object (object_type, object_id, tag_id) SELECT $1, $2, unnest($3::int[]) ON CONFLICT DO NOTHING',
      [objectType, objectId, [...new Set(tagIds.map(Number))]]
    );
  }
}

// ORDER BY terms that put the best matches of a search first: exact match,
// then starts with, then contains (case-insensitive); within each, the
// shortest value first (10.0.0.1 before 10.0.0.10), then alphabetical.
// `columns`: one or more SQL expressions (best rank of any of them);
// `param`: the placeholder of the raw search text ($1, or w.param(search)).
//   ORDER BY ${matchOrder(['name', 'system_id'], '$1')}
export function matchOrder(columns, param) {
  const cols = [].concat(columns);
  return `${matchRank(cols, param)}, LENGTH(${cols[0]}), ${cols[0]}`;
}

// Just the rank (0 exact, 1 starts with, 2 otherwise), best over `columns`,
// for lists that keep their own order within a rank.
export function matchRank(columns, param) {
  const rank = (c) => `CASE WHEN LOWER(${c}) = LOWER(${param}) THEN 0 WHEN LOWER(${c}) LIKE LOWER(${param}) || '%' THEN 1 ELSE 2 END`;
  const cols = [].concat(columns);
  return cols.length > 1 ? `LEAST(${cols.map(rank).join(', ')})` : rank(cols[0]);
}

// ORDER BY prefix of a list page: while searching, best matches first (rank
// of `columns`, see matchRank), then the page's own order; '' with no search.
// `columns`: SQL expressions, or (param) => expressions when one needs the
// search placeholder itself (e.g. an exact IP lookup in a subquery).
//   ORDER BY ${searchRank(['s.name'], search, w)}s.updated_at DESC
export function searchRank(columns, search, w) {
  const term = String(search ?? '').trim();
  if (!term) return '';
  const param = w.param(term);
  return `${matchRank(typeof columns === 'function' ? columns(param) : columns, param)}, `;
}

// JSON array of {id, name} etc. for json_agg in list queries:
//   ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags
// Fine for one or two joined lists; several of them in one query multiply each
// other's rows (and the planner's estimates): use subList() instead.
export function jsonList(nullCheck, fields) {
  const obj = Object.entries(fields).map(([k, v]) => `'${k}', ${v}`).join(', ');
  return `COALESCE(json_agg(DISTINCT jsonb_build_object(${obj})) FILTER (WHERE ${nullCheck}.id IS NOT NULL), '[]')`;
}

// JSON array of objects built by a correlated subquery: one small query per
// parent row, so lists never multiply each other and the parent query needs
// no GROUP BY (LIMIT applies first). `from` is the subquery's FROM ... WHERE,
// tied to the parent alias; ordered by `orderBy` (id: the order jsonList gave).
// Duplicate objects are dropped, like jsonList's DISTINCT (some link tables
// have no unique constraint).
//   ${subList({ id: 't.id', name: 't.name' },
//     `FROM tag_object x JOIN tags t ON t.id = x.tag_id WHERE x.object_type = 'server' AND x.object_id = s.id`, 't.id')} AS tags
export function subList(fields, from, orderBy) {
  const obj = Object.entries(fields).map(([k, v]) => `'${k}', ${v}`).join(', ');
  return `COALESCE((SELECT json_agg(o ORDER BY k) FROM (SELECT DISTINCT jsonb_build_object(${obj}) AS o, ${orderBy} AS k ${from}) sub_list), '[]')`;
}
