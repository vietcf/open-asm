// DANGER: drops every table in the public schema (all data, plus the
// migration history), leaving an empty database for `migrate.js up`.
// Intended for development only. Requires an explicit --yes:
//
//   node migrations/tools/drop_all_tables.js --yes
import { pool } from '../../config/config.js';

async function run() {
  if (!process.argv.includes('--yes')) {
    throw new Error(`This deletes ALL data in database "${process.env.POSTGRES_DB}". Re-run with --yes to confirm.`);
  }
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--production')) {
    throw new Error('NODE_ENV=production: also pass --production if you really mean it.');
  }
  const { rows } = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  for (const { tablename } of rows) {
    await pool.query(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
  }
  console.log(`Dropped ${rows.length} table(s) from "${process.env.POSTGRES_DB}".`);
}

run()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
