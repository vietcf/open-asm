#!/usr/bin/env node
// Data migration: copy every row of an existing Open ASM database (source,
// any earlier version, e.g. v1.1.0 installed from main) into a freshly
// installed database (target, already brought up to date by
// `npm run migrate`). See migrations/README.md "Data migration".
//
//   SOURCE_DATABASE_URL=postgres://user:pass@host:5432/old_db \
//     node migrations/data/migrate_data.js [--dry-run]
//   SOURCE_POSTGRES_DB=old_db node migrations/data/migrate_data.js
//     (same server and credentials as the target, other database)
//
// The target is the database of the normal config (POSTGRES_*). Fresh
// installs never run this; it is a separate, explicit step.
//
// - The target must be up to date and hold no data besides the seeds
//   (roles, permissions, configuration, initial admin). Seed tables are
//   replaced by the source rows, then the seeds run again to add whatever
//   the new version introduced.
// - Columns are matched by name; values go through text and are cast to the
//   target column type. Source columns the target no longer has are
//   reported, a target NOT NULL column without default that the source
//   lacks stops the run before anything is written.
// - Everything runs in one transaction: any error leaves the target
//   untouched. --dry-run does the whole copy, then rolls back.
// - Version-specific conversions go in POST_COPY_STEPS.
import pg from 'pg';
import { discover, readHistory, plan, HISTORY_TABLE } from '../lib/runner.js';
import { seedPermissionsAndRoles, seedConfiguration } from '../lib/seed.js';
import { up as normalizeOptionConfigs } from '../versions/0004_normalize_option_configs.js';
import { up as fixUploadFilenames } from '../versions/0007_fix_upload_filename_encoding.js';

// Never copied: migration bookkeeping (old alters runner and the current
// runner) and login sessions.
const SKIP_TABLES = new Set([HISTORY_TABLE, 'schema_migrations', 'session']);

// Tables the seeds fill on a fresh install; allowed to hold rows in the target.
const SEED_TABLES = new Set(['roles', 'permissions', 'role_permissions', 'configuration', 'users']);

// Conversions applied to the target after the copy, before the seeds, in
// order. Add one whenever a release changes the meaning or format of stored
// data: { name, sql } or { name, run: async db => ... }. The in-place
// upgrade path needs the same change as a migrations/versions/ file; reuse
// its up() here so both paths convert the same way.
const POST_COPY_STEPS = [
  { name: '0004 option lists -> [{value, label}]', run: normalizeOptionConfigs },
  { name: '0005 drop device_page_size', sql: `DELETE FROM configuration WHERE key = 'device_page_size'` },
  { name: '0007 repair latin1-decoded upload filenames', run: fixUploadFilenames },
];

const BATCH_ROWS = 1000;
const MAX_PARAMS = 60000; // Postgres limit is 65535 bind parameters

const ident = name => '"' + String(name).replace(/"/g, '""') + '"';

async function listTables(db) {
  const { rows } = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  return rows.map(r => r.tablename);
}

async function listColumns(db, table) {
  const { rows } = await db.query(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS not_null,
            (a.atthasdef OR a.attidentity <> '') AS has_default,
            a.attgenerated <> '' AS generated
       FROM pg_attribute a
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [`public.${ident(table)}`]
  );
  return rows;
}

async function primaryKey(db, table) {
  const { rows } = await db.query(
    `SELECT a.attname AS name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)`,
    [`public.${ident(table)}`]
  );
  return rows.map(r => r.name);
}

// Parent tables first, from the target's foreign keys. Self references are
// ignored (rows are inserted in primary-key order).
async function dependencyOrder(db, tables) {
  const { rows } = await db.query(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
       FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`
  );
  const strip = n => n.replace(/^public\./, '').replace(/^"|"$/g, '');
  const parents = new Map(tables.map(t => [t, new Set()]));
  for (const r of rows) {
    const child = strip(r.child);
    const parent = strip(r.parent);
    if (child !== parent && parents.has(child) && parents.has(parent)) parents.get(child).add(parent);
  }
  const ordered = [];
  const state = new Map(); // 1 = visiting, 2 = done
  const visit = (t, path) => {
    if (state.get(t) === 2) return;
    if (state.get(t) === 1) throw new Error(`Foreign key cycle: ${[...path, t].join(' -> ')}`);
    state.set(t, 1);
    for (const p of parents.get(t)) visit(p, [...path, t]);
    state.set(t, 2);
    ordered.push(t);
  };
  tables.forEach(t => visit(t, []));
  return ordered;
}

async function countRows(db, table) {
  const { rows } = await db.query(`SELECT COUNT(*)::bigint AS n FROM ${ident(table)}`);
  return Number(rows[0].n);
}

async function checkTargetReady(target) {
  const { rows } = await target.query(`SELECT to_regclass($1) AS t`, [`public.${HISTORY_TABLE}`]);
  if (!rows[0].t) throw new Error('Target has no migration history. Install it first: npm run migrate');
  const { pending, problems } = plan(discover(), await readHistory(target));
  if (problems.length) throw new Error(`Target migrations are inconsistent:\n  - ${problems.join('\n  - ')}`);
  if (pending.length) throw new Error(`Target has pending migrations (${pending.map(m => m.file).join(', ')}). Run: npm run migrate`);
}

async function copyTable(source, target, table, cols, orderBy) {
  const selectList = cols.map(c => `${ident(c.name)}::text`).join(', ');
  const insertCols = cols.map(c => ident(c.name)).join(', ');
  const batch = Math.max(1, Math.min(BATCH_ROWS, Math.floor(MAX_PARAMS / cols.length)));
  let copied = 0;
  for (let offset = 0; ; offset += batch) {
    const { rows } = await source.query({
      text: `SELECT ${selectList} FROM ${ident(table)} ORDER BY ${orderBy} LIMIT ${batch} OFFSET ${offset}`,
      rowMode: 'array',
    });
    if (!rows.length) break;
    const params = [];
    const values = rows.map(row => '(' + row.map((v, i) => {
      params.push(v);
      return `$${params.length}::${cols[i].type}`;
    }).join(', ') + ')');
    await target.query(
      `INSERT INTO ${ident(table)} (${insertCols}) OVERRIDING SYSTEM VALUE VALUES ${values.join(', ')}`,
      params
    );
    copied += rows.length;
    if (rows.length < batch) break;
  }
  return copied;
}

// Serial/identity columns continue after the copied ids.
async function resetSequences(target, tables) {
  for (const table of tables) {
    const { rows } = await target.query(
      `SELECT a.attname AS col, pg_get_serial_sequence($1, a.attname) AS seq
         FROM pg_attribute a
        WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
      [`public.${ident(table)}`]
    );
    for (const { col, seq } of rows) {
      if (!seq) continue;
      await target.query(
        `SELECT setval($1, COALESCE((SELECT MAX(${ident(col)}) FROM ${ident(table)}), 0) + 1, false)`,
        [seq]
      );
    }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = process.env;
  let sourceConfig;
  if (env.SOURCE_DATABASE_URL) {
    sourceConfig = { connectionString: env.SOURCE_DATABASE_URL };
  } else if (env.SOURCE_POSTGRES_DB) {
    sourceConfig = {
      host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD, database: env.SOURCE_POSTGRES_DB,
      ssl: env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
  } else {
    throw new Error('Set SOURCE_POSTGRES_DB (old database on the same server) or SOURCE_DATABASE_URL (postgres://user:pass@host:5432/db)');
  }

  const { pool } = await import('../../config/config.js');
  const source = new pg.Client(sourceConfig);
  await source.connect();
  const target = await pool.connect();
  try {
    const sameDb = (await source.query('SELECT current_database() AS d, inet_server_addr()::text AS h, inet_server_port() AS p')).rows[0];
    const targetDb = (await target.query('SELECT current_database() AS d, inet_server_addr()::text AS h, inet_server_port() AS p')).rows[0];
    if (sameDb.d === targetDb.d && sameDb.h === targetDb.h && sameDb.p === targetDb.p) {
      throw new Error('Source and target are the same database');
    }
    console.log(`[data] source: ${sameDb.d}  ->  target: ${targetDb.d}${dryRun ? '  (dry run)' : ''}`);

    await checkTargetReady(target);

    const sourceTables = new Set((await listTables(source)).filter(t => !SKIP_TABLES.has(t)));
    const targetTables = (await listTables(target)).filter(t => !SKIP_TABLES.has(t));
    const common = targetTables.filter(t => sourceTables.has(t));
    const sourceOnly = [...sourceTables].filter(t => !targetTables.includes(t));

    const notEmpty = [];
    for (const t of targetTables) {
      if (!SEED_TABLES.has(t) && await countRows(target, t) > 0) notEmpty.push(t);
    }
    if (notEmpty.length) {
      throw new Error(`Target already holds data in: ${notEmpty.join(', ')}. Use a freshly installed database.`);
    }

    // Plan every table before writing anything.
    const plans = [];
    const warnings = sourceOnly.map(t => `table "${t}" exists only in the source and is not copied`);
    for (const table of await dependencyOrder(target, common)) {
      const targetCols = await listColumns(target, table);
      const sourceColNames = new Set((await listColumns(source, table)).map(c => c.name));
      const cols = targetCols.filter(c => !c.generated && sourceColNames.has(c.name));
      for (const c of targetCols) {
        if (!sourceColNames.has(c.name) && c.not_null && !c.has_default && !c.generated) {
          throw new Error(`${table}.${c.name} is NOT NULL without default and missing in the source: add a conversion`);
        }
      }
      const targetColNames = new Set(targetCols.map(c => c.name));
      for (const name of sourceColNames) {
        if (!targetColNames.has(name)) warnings.push(`column "${table}.${name}" exists only in the source and is not copied`);
      }
      const pk = (await primaryKey(source, table)).filter(n => cols.some(c => c.name === n));
      const orderBy = (pk.length ? pk : cols.map(c => c.name)).map(ident).join(', ');
      plans.push({ table, cols, orderBy });
    }
    warnings.forEach(w => console.warn(`[data] warning: ${w}`));

    await target.query('BEGIN');
    try {
      // Seed rows are replaced by the source's own roles, permissions,
      // configuration and users.
      await target.query(`TRUNCATE ${plans.map(p => ident(p.table)).join(', ')} RESTART IDENTITY CASCADE`);

      const report = [];
      for (const p of plans) {
        const expected = await countRows(source, p.table);
        const copied = p.cols.length ? await copyTable(source, target, p.table, p.cols, p.orderBy) : 0;
        if (copied !== expected) throw new Error(`${p.table}: copied ${copied} of ${expected} rows`);
        report.push([p.table, copied]);
      }
      await resetSequences(target, plans.map(p => p.table));

      for (const step of POST_COPY_STEPS) {
        console.log(`[data] conversion: ${step.name}`);
        if (step.run) await step.run(target);
        else await target.query(step.sql);
      }

      // New permissions and configuration keys of this version.
      await seedPermissionsAndRoles(target);
      await seedConfiguration(target);

      const admins = await target.query(
        `SELECT COUNT(*)::int AS n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'superadmin'`
      );
      if (!admins.rows[0].n) console.warn('[data] warning: no superadmin in the copied users; run npm run migrate to create one');

      const width = Math.max(...report.map(r => r[0].length));
      report.filter(r => r[1] > 0).forEach(([t, n]) => console.log(`[data]   ${t.padEnd(width)}  ${n}`));
      const total = report.reduce((s, r) => s + r[1], 0);

      if (dryRun) {
        await target.query('ROLLBACK');
        console.log(`[data] dry run OK: ${total} rows in ${report.length} tables would be copied; nothing was changed`);
      } else {
        await target.query('COMMIT');
        console.log(`[data] done: ${total} rows in ${report.length} tables copied`);
      }
    } catch (err) {
      await target.query('ROLLBACK').catch(() => {});
      throw err;
    }
  } finally {
    target.release();
    await pool.end();
    await source.end();
  }
}

main().catch(err => {
  console.error(`[data] failed, target unchanged: ${err.message}`);
  process.exitCode = 1;
});
