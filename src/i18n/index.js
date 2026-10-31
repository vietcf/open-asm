// Minimal gettext-style i18n.
//
// The English text IS the key:   t('Add System')  ->  "Thêm hệ thống" (vi)
// so templates stay readable and an untranslated string simply shows in
// English. Translations live in src/i18n/locales/<lang>.json as
// { "English text": "Translated text" }. English needs no file.
//
// Placeholders: t('Showing {from} to {to} of {total}', { from: 1, to: 10, total: 42 })
//
// `npm run i18n:check` lists strings used in the code that have no translation.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'locales');

export const LANGUAGES = {
  en: { code: 'en', name: 'English', flag: 'EN' },
  vi: { code: 'vi', name: 'Tiếng Việt', flag: 'VI' },
};
export const SUPPORTED = Object.keys(LANGUAGES);
export const DEFAULT_LANGUAGE = SUPPORTED.includes(process.env.DEFAULT_LANGUAGE) ? process.env.DEFAULT_LANGUAGE : 'en';

const catalogs = {};
function loadCatalogs() {
  for (const lang of SUPPORTED) {
    const file = path.join(LOCALES_DIR, `${lang}.json`);
    catalogs[lang] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }
}
loadCatalogs();

export function getCatalog(lang) {
  return catalogs[lang] || {};
}

export function normalizeLanguage(value) {
  if (!value) return null;
  const code = String(value).trim().toLowerCase().slice(0, 2);
  return SUPPORTED.includes(code) ? code : null;
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined && params[name] !== null ? String(params[name]) : m));
}

// Keys ending in ": " also translate messages that start with them, so
// 'Error creating device: ' + err.message is translated too (prefix only).
const prefixKeys = {};
function buildPrefixKeys() {
  for (const lang of SUPPORTED) {
    prefixKeys[lang] = Object.keys(catalogs[lang] || {})
      .filter(k => k.endsWith(': ') && catalogs[lang][k])
      .sort((a, b) => b.length - a.length);
  }
}
buildPrefixKeys();

export function translate(lang, text, params) {
  if (text === undefined || text === null) return '';
  const key = String(text);
  if (lang === 'en') return interpolate(key, params);
  const catalog = catalogs[lang] || {};
  let translated = catalog[key];
  if (!translated) {
    const prefix = prefixKeys[lang]?.find(k => key.startsWith(k));
    if (prefix) translated = catalog[prefix] + key.slice(prefix.length);
  }
  return interpolate(translated || key, params);
}

// Picks the first supported language from an Accept-Language header.
export function fromAcceptLanguage(header) {
  if (!header) return null;
  const ranked = String(header).split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: normalizeLanguage(tag), q: q ? Number(q) : 1 };
    })
    .filter(x => x.lang)
    .sort((a, b) => b.q - a.q);
  return ranked.length ? ranked[0].lang : null;
}

export function createTranslator(lang) {
  const t = (text, params) => translate(lang, text, params);
  t.lang = lang;
  return t;
}

// Reload translations without restarting (used by tests / dev tools).
export function reloadCatalogs() {
  loadCatalogs();
  buildPrefixKeys();
}
