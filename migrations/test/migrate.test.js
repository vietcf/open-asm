// Integration tests for migrations/migrate.js against a real PostgreSQL.
// Uses the POSTGRES_* settings from .env (the user needs CREATEDB); every
// test works in its own throw-away database, dropped afterwards.
//
//   npm run test:migrations
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERSIONS = path.join(ROOT, 'migrations', 'versions');
const conn = {
  host: process.env.POSTGRES_HOST, port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
};
const created = [];

async function admin(sql) {
  const c = new pg.Client({ ...conn, database: 'postgres' });
  await c.connect();
  try { return await c.query(sql); } finally { await c.end(); }
}

async function freshDb() {
  const name = `openasm_mtest_${process.pid}_${created.length}`;
  await admin(`DROP DATABASE IF EXISTS ${name}`);
  await admin(`CREATE DATABASE ${name}`);
  created.push(name);
  return name;
}

async function q(db, sql, params) {
  const c = new pg.Client({ ...conn, database: db });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}

// Temp versions folder with ONLY the baseline plus the given extra files, so
// runner-mechanics tests don't depend on (or collide with) real migrations.
function versionsDir(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openasm-mig-'));
  fs.copyFileSync(path.join(VERSIONS, '0001_baseline.sql'), path.join(dir, '0001_baseline.sql'));
  for (const [f, body] of Object.entries(extra)) fs.writeFileSync(path.join(dir, f), body);
  return dir;
}

function migrate(db, args = [], { dir = VERSIONS, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'migrations', 'migrate.js'), ...args], {
      cwd: ROOT,
      env: { ...process.env, POSTGRES_DB: db, MIGRATIONS_DIR: dir, ADMIN_PASSWORD: '', ...env },
    });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => resolve({ code, out }));
  });
}

after(async () => {
  for (const db of created) await admin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
});

test('fresh database: baseline + seeds + admin with generated password', async () => {
  const db = await freshDb();
  const r = await migrate(db);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /applying 0001_baseline\.sql/);
  assert.match(r.out, /applying 0002_add_user_language\.sql/);
  assert.match(r.out, /password : \S{16}/);
  const [{ n }] = await q(db, `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'`);
  assert.equal(n, 52); // 51 app tables + migrations_history
  const users = await q(db, 'SELECT username, must_change_password FROM users');
  assert.deepEqual(users, [{ username: 'admin', must_change_password: true }]);
});

test('second run is a no-op and does not create another admin', async () => {
  const db = await freshDb();
  await migrate(db);
  const r = await migrate(db);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /schema up to date/);
  assert.doesNotMatch(r.out, /administrator account created/);
  assert.equal((await q(db, 'SELECT * FROM users')).length, 1);
});

test('ADMIN_* variables are used; password is not printed', async () => {
  const db = await freshDb();
  const r = await migrate(db, [], { env: { ADMIN_USERNAME: 'SysAdmin', ADMIN_PASSWORD: 'x-Secret-123' } });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /x-Secret-123/);
  assert.equal((await q(db, 'SELECT username FROM users'))[0].username, 'sysadmin');
});

test('existing v1.1.0 database (no history) is adopted, not re-created', async () => {
  const db = await freshDb();
  await q(db, fs.readFileSync(path.join(VERSIONS, '0001_baseline.sql'), 'utf8'));
  await q(db, `INSERT INTO agents (name) VALUES ('keep-me')`);
  const r = await migrate(db);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /adopted/);
  const [h] = await q(db, 'SELECT version, adopted FROM migrations_history');
  assert.deepEqual(h, { version: 1, adopted: true });
  assert.equal((await q(db, 'SELECT name FROM agents'))[0].name, 'keep-me');
});

test('incomplete existing database is refused', async () => {
  const db = await freshDb();
  await q(db, 'CREATE TABLE users (id serial primary key)');
  const r = await migrate(db);
  assert.equal(r.code, 1);
  assert.match(r.out, /not a complete v1\.1\.0 schema/);
});

test('new SQL migration is applied once and recorded', async () => {
  const db = await freshDb();
  await migrate(db, [], { dir: versionsDir() });
  const dir = versionsDir({ '0002_add_agent_vendor.sql': 'ALTER TABLE agents ADD COLUMN vendor TEXT;' });
  let r = await migrate(db, [], { dir });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /applying 0002_add_agent_vendor\.sql/);
  r = await migrate(db, [], { dir });
  assert.doesNotMatch(r.out, /applying/);
  assert.equal((await q(db, `SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='vendor'`)).length, 1);
});

test('failing migration is rolled back entirely and stops later ones', async () => {
  const db = await freshDb();
  await migrate(db, [], { dir: versionsDir() });
  const dir = versionsDir({
    '0002_broken.sql': 'ALTER TABLE agents ADD COLUMN half_done TEXT;\nSELECT * FROM no_such_table;',
    '0003_after.sql': 'ALTER TABLE agents ADD COLUMN after_col TEXT;',
  });
  const r = await migrate(db, [], { dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /0002_broken\.sql failed and was rolled back/);
  const cols = await q(db, `SELECT column_name FROM information_schema.columns WHERE table_name='agents' AND column_name IN ('half_done','after_col')`);
  assert.deepEqual(cols, []);
  assert.deepEqual((await q(db, 'SELECT version FROM migrations_history ORDER BY 1')).map(x => x.version), [1]);
});

test('JS migration with up(db) runs in a transaction', async () => {
  const db = await freshDb();
  await migrate(db, [], { dir: versionsDir() });
  const dir = versionsDir({
    '0002_data_fix.js': `export async function up(db) { await db.query("INSERT INTO agents (name) VALUES ('from-js')"); }`,
  });
  const r = await migrate(db, [], { dir });
  assert.equal(r.code, 0, r.out);
  assert.equal((await q(db, `SELECT count(*)::int AS n FROM agents WHERE name='from-js'`))[0].n, 1);
});

test('no-transaction directive allows CREATE INDEX CONCURRENTLY', async () => {
  const db = await freshDb();
  await migrate(db, [], { dir: versionsDir() });
  const dir = versionsDir({
    '0002_idx.sql': '-- migrate:no-transaction\nCREATE INDEX CONCURRENTLY idx_agents_version ON agents (version);',
  });
  const r = await migrate(db, [], { dir });
  assert.equal(r.code, 0, r.out);
  assert.equal((await q(db, `SELECT 1 FROM pg_indexes WHERE indexname='idx_agents_version'`)).length, 1);
});

test('editing an applied migration is detected; repair accepts it', async () => {
  const db = await freshDb();
  const dir = versionsDir({ '0002_x.sql': 'ALTER TABLE agents ADD COLUMN x TEXT;' });
  await migrate(db, [], { dir });
  fs.writeFileSync(path.join(dir, '0002_x.sql'), '-- reformatted\nALTER TABLE agents ADD COLUMN x TEXT;');
  let r = await migrate(db, [], { dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /0002_x\.sql was modified after it was applied/);
  r = await migrate(db, ['repair'], { dir });
  assert.equal(r.code, 0, r.out);
  r = await migrate(db, [], { dir });
  assert.equal(r.code, 0, r.out);
});

test('out-of-order and duplicate versions are refused', async () => {
  const db = await freshDb();
  await migrate(db, [], { dir: versionsDir({ '0003_c.sql': 'SELECT 1;' }) });
  let r = await migrate(db, [], { dir: versionsDir({ '0002_b.sql': 'SELECT 1;', '0003_c.sql': 'SELECT 1;' }) });
  assert.equal(r.code, 1);
  assert.match(r.out, /0002_b\.sql is pending but version 0003 is already applied/);
  r = await migrate(db, [], { dir: versionsDir({ '0003_c.sql': 'SELECT 1;', '0003_d.sql': 'SELECT 1;' }) });
  assert.equal(r.code, 1);
  assert.match(r.out, /Duplicate migration version 0003/);
});

test('applied migration missing on disk is refused (code older than database)', async () => {
  const db = await freshDb();
  await migrate(db, [], { dir: versionsDir({ '0002_new.sql': 'SELECT 1;' }) });
  const r = await migrate(db, [], { dir: versionsDir() });
  assert.equal(r.code, 1);
  assert.match(r.out, /0002 \(new\) is applied in the database but its file is missing/);
});

test('concurrent runs: exactly one applies, all succeed', async () => {
  const db = await freshDb();
  const results = await Promise.all([1, 2, 3].map(() => migrate(db)));
  for (const r of results) assert.equal(r.code, 0, r.out);
  assert.equal(results.filter(r => /applying 0001_baseline/.test(r.out)).length, 1);
  assert.equal((await q(db, 'SELECT * FROM users')).length, 1);
});

test('dry-run changes nothing', async () => {
  const db = await freshDb();
  const r = await migrate(db, ['up', '--dry-run']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /would apply:\s+0001_baseline\.sql/);
  assert.equal((await q(db, `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'`))[0].n, 0);
});

test('status lists migrations; create scaffolds the next version', async () => {
  const db = await freshDb();
  const dir = versionsDir();
  await migrate(db, [], { dir });
  let r = await migrate(db, ['create', 'Add owner to servers'], { dir });
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(path.join(dir, '0002_add_owner_to_servers.sql')));
  r = await migrate(db, ['status'], { dir });
  assert.match(r.out, /applied\s+0001_baseline\.sql/);
  assert.match(r.out, /pending\s+0002_add_owner_to_servers\.sql/);
});

test('wrong database password fails fast', async () => {
  const db = await freshDb();
  const t = Date.now();
  const r = await migrate(db, [], { env: { POSTGRES_PASSWORD: 'definitely-wrong' } });
  assert.equal(r.code, 1);
  assert.ok(Date.now() - t < 10000, 'should not retry on authentication errors');
});
