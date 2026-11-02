// Resolves the UI language for every request and exposes the translator:
//   req.t / res.locals.t   translate a string
//   res.locals.lang        current language code ('en' | 'vi')
//   res.locals.languages   list for the language switcher
//
// Priority: ?lang=xx (explicit switch, remembered) > session > lang cookie
//           > Accept-Language > DEFAULT_LANGUAGE.
// An explicit switch by a logged-in user is also saved to users.language,
// so the choice follows them to other browsers (applied again at login).
import { pool } from '../../config/config.js';
import {
  LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage, fromAcceptLanguage, createTranslator,
} from '../i18n/index.js';
import { withTranslator } from '../utils/viewHelpers.js';

const COOKIE = 'lang';
const ONE_YEAR = 365 * 24 * 3600 * 1000;

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export default async function i18n(req, res, next) {
  const explicit = normalizeLanguage(req.query.lang);
  let lang = explicit
    || normalizeLanguage(req.session?.lang)
    || normalizeLanguage(readCookie(req, COOKIE))
    || fromAcceptLanguage(req.headers['accept-language'])
    || DEFAULT_LANGUAGE;

  if (explicit) {
    if (req.session) req.session.lang = explicit;
    res.cookie(COOKIE, explicit, { maxAge: ONE_YEAR, httpOnly: false, sameSite: 'lax' });
    const user = req.session?.user;
    if (user?.id && user.language !== explicit) {
      try {
        await pool.query('UPDATE users SET language = $1 WHERE id = $2', [explicit, user.id]);
        user.language = explicit;
      } catch (err) {
        console.error('Could not save language preference:', err.message);
      }
    }
  }

  const t = createTranslator(lang);
  req.lang = lang;
  req.t = t;
  res.locals.lang = lang;
  res.locals.t = t;
  res.locals.ui = withTranslator(t);
  res.locals.languages = Object.values(LANGUAGES);
  // URL of the current page with ?lang=xx replaced, for the switcher links.
  res.locals.langUrl = (code) => {
    const url = new URL(req.originalUrl, 'http://x');
    url.searchParams.set('lang', code);
    return url.pathname + url.search;
  };
  next();
}

// Called after a successful login: the user's saved preference wins;
// otherwise the language they were using on the login page is saved.
export async function applyUserLanguage(req, user) {
  const saved = normalizeLanguage(user.language);
  if (saved) {
    req.session.lang = saved;
    return;
  }
  const current = normalizeLanguage(req.session.lang) || req.lang;
  if (current && user.id) {
    req.session.lang = current;
    try {
      await pool.query('UPDATE users SET language = $1 WHERE id = $2', [current, user.id]);
      if (req.session.user) req.session.user.language = current;
    } catch (err) {
      console.error('Could not save language preference:', err.message);
    }
  }
}
