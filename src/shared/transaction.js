import { pool } from '../../config/config.js';

// Runs fn(client) inside a transaction, opening/committing/rolling back its own
// client when none is passed in. Callers that already hold a client (e.g. a
// batch operation spanning multiple service calls) pass it through so all
// calls share one transaction.
export async function withTransaction(client, fn) {
  if (client) return fn(client);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
}
