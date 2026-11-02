// Records that use the values of a configured option list, from the `usedBy`
// columns of src/utils/configRegistry.js: usage counts for the System
// Configuration editor, and "replace with" when a used value is removed.
// Table / column names come from the registry only, never from a request.
import { db } from '../shared/db.js';
import { fieldFor } from './configRegistry.js';

const usesOf = (key) => fieldFor(key)?.usedBy || [];

// value -> number of records using it, over every column of the list
export async function usageCounts(key, client) {
  const counts = new Map();
  for (const { table, column, multi } of usesOf(key)) {
    const sql = multi
      ? `SELECT v AS value, COUNT(*)::int AS n FROM ${table},
           jsonb_array_elements_text(CASE WHEN jsonb_typeof(${column}) = 'array' THEN ${column} ELSE '[]'::jsonb END) AS v
         GROUP BY v`
      : `SELECT ${column}::text AS value, COUNT(*)::int AS n FROM ${table}
         WHERE ${column} IS NOT NULL AND ${column}::text <> '' GROUP BY 1`;
    for (const { value, n } of (await db(client).query(sql)).rows) counts.set(value, (counts.get(value) || 0) + n);
  }
  return counts;
}

// Every record holding `from` gets `to` instead (in a JSONB array: once, order
// kept). Returns the number of records changed.
export async function replaceValue(key, from, to, client) {
  let changed = 0;
  for (const { table, column, multi } of usesOf(key)) {
    const sql = multi
      ? `UPDATE ${table} SET ${column} = (
           SELECT COALESCE(jsonb_agg(x ORDER BY ord), '[]'::jsonb) FROM (
             SELECT DISTINCT ON (x) x, ord FROM (
               SELECT CASE WHEN e = $1 THEN $2 ELSE e END AS x, ord
               FROM jsonb_array_elements_text(${column}) WITH ORDINALITY AS a(e, ord)
             ) mapped ORDER BY x, ord
           ) kept)
         WHERE jsonb_typeof(${column}) = 'array' AND ${column} ? $1`
      : `UPDATE ${table} SET ${column} = $2 WHERE ${column} = $1`;
    changed += (await db(client).query(sql, [from, to])).rowCount;
  }
  return changed;
}
