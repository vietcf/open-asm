// Versioned, forward-only migration runner for PostgreSQL.
//
// Files live in migrations/versions/ and are named NNNN_snake_case_name.sql
// (or .js for data migrations that need code). Each file runs exactly once
// per database, in version order, inside its own transaction, and is recorded
// in the migrations_history table together with a SHA-256 checksum of its
// contents. See migrations/README.md for the full rules.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERSIONS_DIR = process.env.MIGRATIONS_DIR
  ? path.resolve(process.env.MIGRATIONS_DIR)
  : path.join(HERE, '..', 'versions');

export const HISTORY_TABLE = 'migrations_history';
export const BASELINE_VERSION = 1;
const LOCK_KEY = 727001; // constant advisory-lock id for this app's migrations
const FILE_RE = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.(sql|js)$/;
const IGNORED = new Set(['README.md', '.gitkeep']);

export class MigrationError extends Error {}

// ---------------------------------------------------------------- discovery

function checksum(text) {
  // Normalise line endings so a CRLF checkout does not look like an edit.
  return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

export function discover(dir = VERSIONS_DIR) {
  const migrations = [];
  const seen = new Map();
  for (const file of fs.readdirSync(dir).sort()) {
    if (IGNORED.has(file)) continue;
    const m = FILE_RE.exec(file);
    if (!m) {
      throw new MigrationError(`Invalid migration file name "${file}" (expected NNNN_snake_case_name.sql|.js)`);
    }
    const version = Number(m[1]);
    if (seen.has(version)) {
      throw new MigrationError(`Duplicate migration version ${m[1]}: "${seen.get(version)}" and "${file}" — renumber one of them`);
    }
    seen.set(version, file);
    const fullPath = path.join(dir, file);
    const text = fs.readFileSync(fullPath, 'utf8');
    migrations.push({
      version,
      name: m[2],
      file,
      kind: m[3],
      path: fullPath,
      text,
      checksum: checksum(text),
      // SQL: a "-- migrate:no-transaction" line opts out (needed for e.g.
      // CREATE INDEX CONCURRENTLY). JS: `export const transaction = false`.
      transaction: m[3] === 'sql' ? !/^--\s*migrate:no-transaction\s*$/m.test(text) : null,
    });
  }
  return migrations;
}

// ------------------------------------------------------------------ history

export async function ensureHistoryTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      version      INTEGER PRIMARY KEY,
      name         TEXT NOT NULL,
      checksum     CHAR(64) NOT NULL,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      execution_ms INTEGER NOT NULL DEFAULT 0,
      adopted      BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
}

export async function readHistory(db) {
  const { rows } = await db.query(
    `SELECT version, name, checksum, applied_at, execution_ms, adopted FROM ${HISTORY_TABLE} ORDER BY version`
  );
  return rows;
}

async function record(db, m, ms, adopted = false) {
  await db.query(
    `INSERT INTO ${HISTORY_TABLE} (version, name, checksum, execution_ms, adopted) VALUES ($1, $2, $3, $4, $5)`,
    [m.version, m.name, m.checksum, ms, adopted]
  );
}

// --------------------------------------------------------------------- plan

// Compares disk with history. Returns { pending, problems[] }. Any problem
// blocks `up`: the database and the code disagree and a human must decide.
export function plan(migrations, history) {
  const byVersion = new Map(migrations.map(m => [m.version, m]));
  const problems = [];
  for (const h of history) {
    const m = byVersion.get(h.version);
    if (!m) {
      problems.push(`Version ${pad(h.version)} (${h.name}) is applied in the database but its file is missing from ${path.basename(VERSIONS_DIR)}/ — is this code older than the database?`);
    } else if (m.checksum !== h.checksum.trim()) {
      problems.push(`${m.file} was modified after it was applied (checksum mismatch). Applied migrations must never change: revert the edit and add a new migration instead. If the edit is cosmetic only, run "migrate.js repair".`);
    }
  }
  const applied = new Set(history.map(h => h.version));
  const maxApplied = history.length ? Math.max(...history.map(h => h.version)) : 0;
  const pending = migrations.filter(m => !applied.has(m.version));
  for (const m of pending) {
    if (m.version < maxApplied) {
      problems.push(`${m.file} is pending but version ${pad(maxApplied)} is already applied (out of order — typically two branches picked the same number range). Renumber it above ${pad(maxApplied)}.`);
    }
  }
  return { pending, problems };
}

export const pad = v => String(v).padStart(4, '0');

// ------------------------------------------------------------------ locking

export async function withLock(client, fn) {
  const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
  if (!rows[0].ok) {
    console.log('[migrate] another migration is running, waiting for it to finish...');
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  }
  try {
    return await fn();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  }
}

// ----------------------------------------------------------------- adoption

function tablesCreatedBy(sql) {
  return [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?/gi)].map(m => m[1].toLowerCase());
}

// A database created before this runner existed (v1.1.0 installs) already has
// the baseline schema but an empty history. Record the baseline as applied
// ("adopted") instead of running it — after checking the schema really is
// there, so a half-created database is reported instead of silently accepted.
export async function adoptIfNeeded(db, migrations, history, { dryRun = false } = {}) {
  if (history.length) return false;
  const { rows } = await db.query(`SELECT to_regclass('public.users') IS NOT NULL AS ok`);
  if (!rows[0].ok) return false; // empty database: baseline will run normally

  const baseline = migrations.find(m => m.version === BASELINE_VERSION);
  if (!baseline) throw new MigrationError('Baseline migration 0001 not found');
  const expected = tablesCreatedBy(baseline.text);
  const { rows: existing } = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const have = new Set(existing.map(r => r.tablename));
  const missing = expected.filter(t => !have.has(t));
  if (missing.length) {
    throw new MigrationError(
      `Existing database is not a complete v1.1.0 schema, cannot adopt it. Missing tables: ${missing.join(', ')}`
    );
  }
  await record(db, baseline, 0, true);
  console.log(dryRun
    ? `[migrate] existing database would be adopted: ${baseline.file} recorded as applied (not executed)`
    : `[migrate] existing database adopted: ${baseline.file} recorded as applied (not executed)`);
  return true;
}

// -------------------------------------------------------------------- apply

async function execute(client, m) {
  if (m.kind === 'sql') {
    await client.query(m.text);
    return;
  }
  const mod = await import(pathToFileURL(m.path).href);
  const up = mod.up || mod.default;
  if (typeof up !== 'function') throw new MigrationError(`${m.file} must export an "up(db)" function`);
  await up(client);
}

export async function apply(client, m) {
  if (m.kind === 'js') {
    const mod = await import(pathToFileURL(m.path).href);
    m.transaction = mod.transaction !== false;
  }
  const started = Date.now();
  if (m.transaction) {
    await client.query('BEGIN');
    try {
      await execute(client, m);
      await record(client, m, Date.now() - started);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new MigrationError(`${m.file} failed and was rolled back: ${err.message}`, { cause: err });
    }
  } else {
    try {
      await execute(client, m);
    } catch (err) {
      throw new MigrationError(`${m.file} failed (ran WITHOUT a transaction — check for partial changes): ${err.message}`, { cause: err });
    }
    await record(client, m, Date.now() - started);
  }
  return Date.now() - started;
}

export async function repairChecksums(db, migrations) {
  const byVersion = new Map(migrations.map(m => [m.version, m]));
  const fixed = [];
  for (const h of await readHistory(db)) {
    const m = byVersion.get(h.version);
    if (m && m.checksum !== h.checksum.trim()) {
      await db.query(`UPDATE ${HISTORY_TABLE} SET checksum = $1 WHERE version = $2`, [m.checksum, m.version]);
      fixed.push(m.file);
    }
  }
  return fixed;
}
