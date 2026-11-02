#!/usr/bin/env node
// Open ASM database migrations — see migrations/README.md.
//
//   node migrations/migrate.js [up]        apply pending migrations (default); seeds only a
//                                          fresh install (no roles yet)
//   node migrations/migrate.js up --dry-run  show what would run, change nothing
//   node migrations/migrate.js seed        run the seeds explicitly
//   node migrations/migrate.js status      list applied / pending migrations
//   node migrations/migrate.js create <name>   scaffold versions/NNNN_<name>.sql
//   node migrations/migrate.js repair      accept cosmetic edits to applied files
//
// Docker runs `up` before every app start; it is a no-op when up to date.
// Exit code is non-zero on any failure, so the app never starts on a
// database that does not match the code.
import fs from 'fs';
import path from 'path';
import {
  VERSIONS_DIR, MigrationError, discover, ensureHistoryTable, readHistory,
  plan, withLock, adoptIfNeeded, apply, repairChecksums, pad,
} from './lib/runner.js';
import { runSeeds, printAdminBanner } from './lib/seed.js';

const CONNECT_TIMEOUT_S = Number(process.env.MIGRATE_CONNECT_TIMEOUT || 90);
const FATAL_PG_CODES = new Set(['28P01', '28000', '3D000']); // bad credentials, missing database

async function connect() {
  const { pool } = await import('../config/config.js');
  const deadline = Date.now() + CONNECT_TIMEOUT_S * 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      const client = await pool.connect();
      return { pool, client };
    } catch (err) {
      if (FATAL_PG_CODES.has(err.code)) throw err;
      if (Date.now() > deadline) throw new Error(`Database not reachable after ${CONNECT_TIMEOUT_S}s: ${err.message}`);
      if (attempt === 1 || attempt % 5 === 0) {
        console.log(`[migrate] waiting for database ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || 5432} (${err.code || err.message})`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function withDb(fn) {
  const { pool, client } = await connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

function failOnProblems(problems) {
  if (!problems.length) return;
  throw new MigrationError(`Database and migration files disagree:\n  - ${problems.join('\n  - ')}`);
}

// Optional (set by the Docker entrypoint): also write a generated initial
// admin password to a file, so it can be read without digging through logs.
// The file is deleted automatically on a later start once the admin has
// changed that password.
async function handleInitialPasswordFile(client, admin) {
  const file = process.env.INITIAL_ADMIN_PASSWORD_FILE;
  if (!file) return;
  if (admin.created && admin.generated) {
    fs.writeFileSync(file, [
      'Open ASM - initial administrator account',
      `username: ${admin.username}`,
      `password: ${admin.password}`,
      '',
      'You must change this password at first login.',
      'This file is deleted automatically on the next start after that.',
      '',
    ].join('\n'), { mode: 0o600 });
    console.log(`[migrate] initial admin password also saved to ${file}`);
    return;
  }
  if (fs.existsSync(file)) {
    const { rows } = await client.query(
      `SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'superadmin' AND u.must_change_password LIMIT 1`
    );
    if (!rows.length) {
      fs.unlinkSync(file);
      console.log(`[migrate] initial admin password was changed -> removed ${file}`);
    }
  }
}

// ---------------------------------------------------------------- commands

async function up({ dryRun }) {
  const migrations = discover();
  await withDb(client => withLock(client, async () => {
    if (dryRun) {
      await client.query('BEGIN'); // everything below is previewed, then rolled back
      try {
        await ensureHistoryTable(client);
        await adoptIfNeeded(client, migrations, await readHistory(client), { dryRun: true });
        const { pending, problems } = plan(migrations, await readHistory(client));
        failOnProblems(problems);
        console.log(pending.length ? `[migrate] would apply:\n${pending.map(m => `  ${m.file}`).join('\n')}` : '[migrate] schema up to date');
      } finally {
        await client.query('ROLLBACK');
      }
      return;
    }
    await ensureHistoryTable(client);
    await adoptIfNeeded(client, migrations, await readHistory(client));
    const { pending, problems } = plan(migrations, await readHistory(client));
    failOnProblems(problems);

    for (const m of pending) {
      process.stdout.write(`[migrate] applying ${m.file} ... `);
      const ms = await apply(client, m);
      console.log(`ok (${ms} ms)`);
    }
    if (!pending.length) console.log('[migrate] schema up to date');

    // Seeds only initialize a fresh install (no roles yet). An existing
    // database is never seeded implicitly: data a new version needs ships as
    // a migration, and `migrate.js seed` runs the seeds on demand.
    const { rows: [{ fresh }] } = await client.query('SELECT NOT EXISTS (SELECT 1 FROM roles) AS fresh');
    if (fresh) await seed(client);
    else console.log('[migrate] existing data: seeds skipped (run `npm run seed` to apply them explicitly)');
    await handleInitialPasswordFile(client, { created: false });
    console.log('[migrate] done');
  }));
}

async function seed(client) {
  console.log('[migrate] seeding roles, permissions, default configuration and the initial admin');
  const admin = await runSeeds(client);
  printAdminBanner(admin);
  await handleInitialPasswordFile(client, admin);
}

// Explicit seeding (`npm run seed`): adds missing roles, permissions and
// default configuration, and the admin when there is no superadmin. Never
// overwrites edited values, but re-grants the default role permissions.
async function seedCommand() {
  await withDb(client => withLock(client, async () => {
    const { rows: [{ ready }] } = await client.query(`SELECT to_regclass('public.roles') IS NOT NULL AS ready`);
    if (!ready) throw new MigrationError('No schema yet: run `migrate.js up` first');
    await seed(client);
    console.log('[migrate] done');
  }));
}

async function status() {
  const migrations = discover();
  await withDb(async client => {
    await ensureHistoryTable(client);
    const history = await readHistory(client);
    const byVersion = new Map(history.map(h => [h.version, h]));
    const { problems } = plan(migrations, history);
    const versions = [...new Set([...migrations.map(m => m.version), ...history.map(h => h.version)])].sort((a, b) => a - b);
    for (const v of versions) {
      const m = migrations.find(x => x.version === v);
      const h = byVersion.get(v);
      const state = !h ? 'pending ' : h.adopted ? 'adopted ' : 'applied ';
      const when = h ? new Date(h.applied_at).toISOString().replace('T', ' ').slice(0, 19) : '';
      console.log(`  ${state} ${m ? m.file : `${pad(v)}_${h.name} (FILE MISSING)`}  ${when}`);
    }
    if (problems.length) {
      console.log(`\nProblems:\n  - ${problems.join('\n  - ')}`);
      process.exitCode = 1;
    }
  });
}

function create(name) {
  const slug = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!slug) throw new MigrationError('Usage: migrate.js create <name>   e.g. create add_owner_to_servers');
  const migrations = discover();
  const next = (migrations.length ? Math.max(...migrations.map(m => m.version)) : 0) + 1;
  const file = path.join(VERSIONS_DIR, `${pad(next)}_${slug}.sql`);
  fs.writeFileSync(file, `-- ${pad(next)}_${slug}
-- What and why:
--
-- Runs once, inside a transaction (do not add BEGIN/COMMIT). Never edit this
-- file after it has been deployed anywhere: write a new migration instead.

`);
  console.log(`Created ${path.relative(process.cwd(), file)}`);
}

async function repair() {
  const migrations = discover();
  await withDb(client => withLock(client, async () => {
    await ensureHistoryTable(client);
    const fixed = await repairChecksums(client, migrations);
    console.log(fixed.length ? `[migrate] checksums updated for: ${fixed.join(', ')}` : '[migrate] nothing to repair');
  }));
}

// -------------------------------------------------------------------- main

const [command = 'up', ...args] = process.argv.slice(2);
const commands = {
  up: () => up({ dryRun: args.includes('--dry-run') }),
  seed: seedCommand,
  status,
  create: () => create(args.join('_')),
  repair,
};

if (!commands[command]) {
  console.error(`Unknown command "${command}". Use: up [--dry-run] | seed | status | create <name> | repair`);
  process.exit(2);
}

Promise.resolve()
  .then(commands[command])
  .catch((err) => {
    console.error(`\n[migrate] FAILED: ${err.message}`);
    const pg = err.cause || err;
    if (pg.code) console.error(`  postgres error ${pg.code}${pg.detail ? `: ${pg.detail}` : ''}${pg.hint ? ` (hint: ${pg.hint})` : ''}`);
    process.exitCode = 1;
  });
