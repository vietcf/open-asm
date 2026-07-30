// Runs every not-yet-applied file in this folder, in filename order, and
// records each one in schema_migrations so re-running this script only picks
// up files added since the last run. To make a new schema change: add a new
// numbered file here (export default async (pool) => {...}), then just run
// `node migrations/alters/run.js` again — no need to track by hand which
// ones are new.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { pool } from '../../config/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function run() {
  await ensureMigrationsTable();

  const files = fs.readdirSync(__dirname)
    .filter(f => /^\d+.*\.js$/.test(f))
    .sort();

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map(r => r.filename));

  const pending = files.filter(f => !applied.has(f));
  if (pending.length === 0) {
    console.log('No new migrations to run.');
    return;
  }

  for (const file of pending) {
    console.log(`Running ${file}...`);
    const mod = await import(pathToFileURL(path.join(__dirname, file)).href);
    await mod.default(pool);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`Applied ${file}`);
  }

  console.log(`Done. Applied ${pending.length} migration(s).`);
}

run()
  .catch((err) => {
    console.error('Migration run failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
