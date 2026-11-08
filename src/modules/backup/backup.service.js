// Database backups: create (scheduled / manual), list, download, delete,
// upload and restore. Dumps are plain `pg_dump` SQL, gzipped, in BACKUP_DIR.
// The schedule and retention come from System Configuration (group "Backup").
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import Configuration from '../administrator/configuration.model.js';
import { siteConfig } from '../../utils/siteConfig.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';

// File name prefix -> kind
export const KINDS = { backup: 'scheduled', manual: 'manual', 'pre-restore': 'pre-restore', upload: 'upload' };
const FILE_NAME = /^(backup|manual|pre-restore|upload)_[A-Za-z0-9._-]+\.sql\.gz$/;
const KEEP_PRE_RESTORE = 3;
const DUMP_MARKER = 'PostgreSQL database dump';
export const RESTORE_CONFIRMATION = 'RESTORE';

export const backupDir = () => path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));

function connection() {
  return {
    args: ['-h', process.env.POSTGRES_HOST || 'localhost', '-p', process.env.POSTGRES_PORT || '5432',
      '-U', process.env.POSTGRES_USER || 'postgres', '-d', process.env.POSTGRES_DB || 'postgres', '--no-password'],
    env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD || '', ...(process.env.POSTGRES_SSL === 'true' ? { PGSSLMODE: 'require' } : {}) },
  };
}

// One backup / restore at a time
let busy = null;
async function exclusive(what, fn) {
  if (busy) throw new ConflictError('A {operation} is already running').withParams({ operation: busy });
  busy = what;
  try { return await fn(); } finally { busy = null; }
}
export const currentOperation = () => busy;

// ===== Settings (System Configuration > Backup) =====
export const DEFAULTS = { enabled: 'on', frequency: 'daily', hour: 2, retention: 7 };

export async function getSettings() {
  const rows = await Configuration.findByKeys(['backup_enabled', 'backup_frequency', 'backup_hour', 'backup_retention']);
  const v = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const hour = parseInt(v.backup_hour, 10);
  const retention = parseInt(v.backup_retention, 10);
  return {
    enabled: (v.backup_enabled || DEFAULTS.enabled) === 'on',
    frequency: ['daily', 'weekly', 'monthly'].includes(v.backup_frequency) ? v.backup_frequency : DEFAULTS.frequency,
    hour: hour >= 0 && hour <= 23 ? hour : DEFAULTS.hour,
    retention: retention >= 1 ? retention : DEFAULTS.retention,
  };
}

// ===== Files =====
function assertName(name) {
  if (!FILE_NAME.test(String(name || ''))) throw new ValidationError('Invalid backup file name');
  return String(name);
}

function describe(name, stat) {
  return { name, kind: KINDS[name.split('_')[0]], size: stat.size, created_at: stat.mtime };
}

export function listBackups() {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => FILE_NAME.test(name))
    .map(name => describe(name, fs.statSync(path.join(dir, name))))
    .sort((a, b) => b.created_at - a.created_at);
}

export function backupPath(name) {
  const file = path.join(backupDir(), assertName(name));
  if (!fs.existsSync(file)) throw new NotFoundError('Backup not found');
  return file;
}

export function deleteBackup(name) {
  fs.unlinkSync(backupPath(name));
}

// Scheduled backups beyond the retention count; pre-restore safety copies beyond KEEP_PRE_RESTORE
export function applyRetention(retention) {
  const dir = backupDir();
  const files = listBackups();
  const drop = [...files.filter(f => f.kind === 'scheduled').slice(retention), ...files.filter(f => f.kind === 'pre-restore').slice(KEEP_PRE_RESTORE)];
  for (const f of drop) fs.unlinkSync(path.join(dir, f.name));
  return drop.map(f => f.name);
}

// ===== pg_dump / psql =====
function run(command, args, { env, input } = {}) {
  const child = spawn(command, args, { env, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim().split('\n').slice(-3).join(' ') || `${command} exited with code ${code}`))));
  });
  return { child, done };
}

// pg_dump | gzip into `<file>.partial`, renamed only when pg_dump succeeded
async function dumpTo(file) {
  const { args, env } = connection();
  const partial = `${file}.partial`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { child, done } = run('pg_dump', args, { env });
  try {
    await Promise.all([pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(partial)), done]);
    if (fs.statSync(partial).size < 100) throw new Error('Backup file is empty');
    fs.renameSync(partial, file);
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw err;
  }
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function createBackupFile(prefix) {
  const name = `${prefix}_${stamp()}.sql.gz`;
  const file = path.join(backupDir(), name);
  await dumpTo(file);
  return describe(name, fs.statSync(file));
}

// prefix: 'backup' (scheduler) or 'manual' (button)
export const createBackup = (prefix = 'manual') => exclusive('backup', async () => {
  const backup = await createBackupFile(prefix);
  if (prefix === 'backup') applyRetention((await getSettings()).retention);
  return backup;
});

// The start of the dump must look like pg_dump output
function readHead(file, bytes = 4096) {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(file);
    const gunzip = zlib.createGunzip();
    const chunks = [];
    let length = 0;
    const finish = (err) => {
      source.destroy();
      gunzip.destroy();
      return err ? reject(new ValidationError('The file is not a valid gzip backup')) : resolve(Buffer.concat(chunks).toString('utf8'));
    };
    source.on('error', finish);
    gunzip.on('error', finish);
    gunzip.on('end', () => finish());
    gunzip.on('data', (chunk) => {
      chunks.push(chunk);
      length += chunk.length;
      if (length >= bytes) finish();
    });
    source.pipe(gunzip);
  });
}

// A restore feeds the file to psql, which runs backslash meta-commands such as
// `\! <shell command>` anywhere outside SQL literals: an uploaded "backup"
// could run commands in the app container. A plain pg_dump file only has
// `\restrict` / `\unrestrict` lines and the `\.` ending each COPY data block,
// so the whole file is lexed (strings, quoted identifiers, dollar quotes,
// comments, COPY data) and any other meta-command is refused, as are
// COPY ... TO/FROM PROGRAM and server-side lo_import / lo_export.
const ALLOWED_META = /^\\(restrict|unrestrict) [A-Za-z0-9]+\s*$/;
const FORBIDDEN_SQL = [/\b(TO|FROM)\s+PROGRAM\b/i, /\blo_(import|export)\s*\(/i];
const COPY_FROM_STDIN = /^COPY\s.+\sFROM\s+stdin;\s*$/i;
const IDENT_CHAR = /[A-Za-z0-9_$]/;

async function scanDump(file) {
  const reject = (what, lineNo) => {
    throw new ValidationError('The backup contains commands that are not allowed in a pg_dump file (line {line}: {what})').withParams({ line: lineNo, what });
  };
  const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let state = 'sql'; // sql | quote | equote | ident | dollar | block
  let dollarTag = '';
  let depth = 0;
  let inCopy = false;
  let lineNo = 0;
  try {
    for await (const line of lines) {
      lineNo += 1;
      if (inCopy) { if (line === '\\.') inCopy = false; continue; }
      if (state === 'sql' && ALLOWED_META.test(line)) continue;
      for (const re of FORBIDDEN_SQL) if (re.test(line)) reject(line.match(re)[0], lineNo);
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (state === 'sql') {
          if (c === '\\') reject('psql meta-command', lineNo);
          if (c === '-' && line[i + 1] === '-') break; // line comment
          if (c === '/' && line[i + 1] === '*') { state = 'block'; depth = 1; i += 1; continue; }
          if (c === '"') { state = 'ident'; continue; }
          if (c === "'") { state = /[eE]/.test(line[i - 1] || '') && !IDENT_CHAR.test(line[i - 2] || '') ? 'equote' : 'quote'; continue; }
          if (c === '$' && !IDENT_CHAR.test(line[i - 1] || '')) {
            const m = line.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
            if (m) { state = 'dollar'; dollarTag = m[0]; i += m[0].length - 1; }
          }
        } else if (state === 'quote') {
          if (c === "'") { if (line[i + 1] === "'") i += 1; else state = 'sql'; }
        } else if (state === 'equote') {
          if (c === '\\') i += 1;
          else if (c === "'") { if (line[i + 1] === "'") i += 1; else state = 'sql'; }
        } else if (state === 'ident') {
          if (c === '"') { if (line[i + 1] === '"') i += 1; else state = 'sql'; }
        } else if (state === 'dollar') {
          if (c === '$' && line.startsWith(dollarTag, i)) { state = 'sql'; i += dollarTag.length - 1; }
        } else if (state === 'block') {
          if (c === '/' && line[i + 1] === '*') { depth += 1; i += 1; } else if (c === '*' && line[i + 1] === '/') { depth -= 1; i += 1; if (!depth) state = 'sql'; }
        }
      }
      if (state === 'sql' && COPY_FROM_STDIN.test(line)) inCopy = true;
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('The file is not a valid gzip backup');
  } finally {
    lines.close();
  }
  if (inCopy) reject('unterminated COPY data', lineNo);
}

async function assertDump(file) {
  if (!(await readHead(file)).includes(DUMP_MARKER)) throw new ValidationError('The file is not a PostgreSQL backup');
  await scanDump(file);
}

// Uploaded file (multer, anywhere on disk) -> a listed `upload_*` backup. .sql or .sql.gz
// Temporary upload that will not be used
export const discardUpload = (tmpFile) => fs.rmSync(tmpFile, { force: true });

export async function importUpload(tmpFile, originalName) {
  try {
    const gz = /\.gz$/i.test(originalName || '');
    if (!gz && !/\.sql$/i.test(originalName || '')) throw new ValidationError('Upload a .sql or .sql.gz file');
    const name = `upload_${stamp()}.sql.gz`;
    const target = path.join(backupDir(), name);
    fs.mkdirSync(backupDir(), { recursive: true });
    if (gz) fs.copyFileSync(tmpFile, target);
    else await pipeline(fs.createReadStream(tmpFile), zlib.createGzip(), fs.createWriteStream(target));
    try {
      await assertDump(target);
    } catch (err) {
      fs.rmSync(target, { force: true });
      throw err;
    }
    return describe(name, fs.statSync(target));
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

// Brings the schema of an older backup up to date (also runs the seeds)
const migrate = () => run(process.execPath, ['migrations/migrate.js', 'up'], { env: process.env }).done;

// Hooks run after a restore (rescheduling the backup job, ...)
const afterRestore = [];
export const onRestore = (fn) => afterRestore.push(fn);

// Replaces the whole database with a backup, atomically: DROP SCHEMA and the
// dump run in one transaction, so a failing dump leaves the database as it
// was. A safety copy of the current state is taken first.
export const restoreBackup = (name, confirmation) => exclusive('restore', async () => {
  if (confirmation !== RESTORE_CONFIRMATION) throw new ValidationError('Type {word} to confirm the restore').withParams({ word: RESTORE_CONFIRMATION });
  const file = backupPath(name);
  await assertDump(file);
  const safety = await createBackupFile('pre-restore');
  const { args, env } = connection();
  const { child, done } = run('psql', [...args, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q',
    '-c', 'DROP SCHEMA public CASCADE', '-c', 'CREATE SCHEMA public', '-f', '-'], { env, input: true });
  child.stdin.on('error', () => {}); // psql may exit before reading everything
  try {
    await Promise.all([pipeline(fs.createReadStream(file), zlib.createGunzip(), child.stdin), done]);
  } catch (err) {
    throw new ValidationError('Restore failed, the database was not changed: {reason}').withParams({ reason: err.message });
  }
  await migrate();
  await siteConfig.initialize();
  for (const fn of afterRestore) await fn();
  applyRetention((await getSettings()).retention);
  return { safety_backup: safety.name };
});
