#!/usr/bin/env node
// Finds every t('...') / req.t('...') / window.t('...') string literal in the
// views and source code and compares it with the translation catalogs.
//
//   npm run i18n:check            report missing / unused translations
//   npm run i18n:check -- --write add missing keys to the catalogs with an
//                                 empty value ("" = falls back to English)
//                                 and sort them, ready to be translated
//   npm run i18n:check -- --prune remove catalog entries no longer used
// Exit code 1 if any translation is missing (empty values count as missing).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = [
  { dir: 'public/html', ext: '.ejs' },
  { dir: 'src', ext: '.js' },
  { dir: 'public/js', ext: '.js', only: ['custom.js', 'server_add.js'] },
];
const LOCALES = path.join(ROOT, 'src/i18n/locales');
// Files that only mention t() in comments/examples.
const SKIP = new Set(['src/i18n/index.js', 'src/routes/i18n.js', 'src/middlewares/i18n.middleware.js']);
// t( 'text' ) with single, double or backtick quotes (no ${} inside backticks)
const CALL_RE = /(?<![\w$.])(?:req\.|res\.locals\.|window\.)?t\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;

function walk(dir, ext, only) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel, ext, only));
    else if (entry.name.endsWith(ext) && (!only || only.includes(entry.name))) out.push(rel);
  }
  return out;
}

function unescape(s) {
  return s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
}

// Strings translated at display time rather than through a literal t():
// page titles, flash messages and error/success values passed to views.
const IMPLICIT_RE = [
  /req\.flash\(\s*'(?:success|error|info|warning)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)\s*\)/g,
  /\b(?:title|error|success|message)\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g,
  /[?&]error=([A-Z][A-Za-z0-9.]*%20[A-Za-z0-9%.]+)/g, // URL-encoded login errors
];
const IMPLICIT_DIRS = ['src/controllers', 'src/middlewares', 'src/routes', 'src/app.js'];
// Parameters of the shared UI partials (page_header, empty_state, pagination)
const VIEW_PARAM_RE = /\b(?:title|label|message|summary|actionLabel)\s*:\s*'((?:[^'\\]|\\.)*)'/g;

const used = new Map(); // text -> first location
for (const { dir, ext, only } of SCAN) {
  for (const file of walk(dir, ext, only)) {
    if (SKIP.has(file)) continue;
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const implicit = IMPLICIT_DIRS.some(d => file.startsWith(d)) ? IMPLICIT_RE
      : (file.endsWith('.ejs') ? [VIEW_PARAM_RE] : []);
    const matches = [...src.matchAll(CALL_RE)].map(m => [m, false])
      .concat(implicit.flatMap(re => [...src.matchAll(re)].map(m => [m, true])));
    for (const [m, isImplicit] of matches) {
      let text = unescape(m[1] ?? m[2] ?? m[3]);
      if (text.includes('%20')) text = decodeURIComponent(text);
      if (!text.trim() || !/[A-Za-zÀ-ỹ]/.test(text)) continue;
      if (isImplicit && !/^[A-Z]/.test(text.trim())) continue; // titles/messages start with a capital
      if (!used.has(text)) used.set(text, `${file}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
}

const write = process.argv.includes('--write');
const prune = process.argv.includes('--prune');
// Strings only used dynamically (not visible to the scanner)
const KEEP = new Set(['No results match your search or filters', 'Something went wrong. Please try again.']);
for (const k of KEEP) if (!used.has(k)) used.set(k, '(dynamic)');
let missingTotal = 0;
for (const file of fs.readdirSync(LOCALES).filter(f => f.endsWith('.json'))) {
  const lang = path.basename(file, '.json');
  const catalogPath = path.join(LOCALES, file);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const missing = [...used.keys()].filter(k => !catalog[k]);
  const unused = Object.keys(catalog).filter(k => !used.has(k));
  missingTotal += missing.length;
  console.log(`[${lang}] ${used.size} strings used, ${Object.keys(catalog).length} in catalog, ${missing.length} missing, ${unused.length} unused`);
  for (const k of missing.slice(0, write ? 0 : 50)) console.log(`  missing: ${JSON.stringify(k)}  (${used.get(k)})`);
  if (!write && missing.length > 50) console.log(`  ... and ${missing.length - 50} more`);
  for (const k of unused.slice(0, 20)) console.log(`  unused:  ${JSON.stringify(k)}`);
  if (prune) for (const k of unused) delete catalog[k];
  if (write || prune) {
    if (write) for (const k of missing) if (!(k in catalog)) catalog[k] = '';
    const sorted = Object.fromEntries(Object.keys(catalog).sort((a, b) => a.localeCompare(b)).map(k => [k, catalog[k]]));
    fs.writeFileSync(catalogPath, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`  wrote ${catalogPath}`);
  }
}
process.exitCode = missingTotal ? 1 : 0;
