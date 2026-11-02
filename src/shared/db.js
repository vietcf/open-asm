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

// JSON array of {id, name} etc. for json_agg in list queries:
//   ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags
export function jsonList(nullCheck, fields) {
  const obj = Object.entries(fields).map(([k, v]) => `'${k}', ${v}`).join(', ');
  return `COALESCE(json_agg(DISTINCT jsonb_build_object(${obj})) FILTER (WHERE ${nullCheck}.id IS NOT NULL), '[]')`;
}
