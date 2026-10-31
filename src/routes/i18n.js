// Serves the translation catalog to the browser as a script:
//   <script src="/i18n/vi.js"></script>   ->  window.t('Delete') === 'Xóa'
// Cached by the browser; the ?v= query string (catalog hash) busts the cache
// whenever translations change.
import crypto from 'crypto';
import express from 'express';
import { SUPPORTED, getCatalog } from '../i18n/index.js';

const router = express.Router();

const scripts = {};
export const catalogVersion = {};
for (const lang of SUPPORTED) {
  const messages = lang === 'en' ? {} : getCatalog(lang);
  const json = JSON.stringify(messages).replace(/</g, '\\u003c');
  scripts[lang] = `window.I18N_LANG=${JSON.stringify(lang)};window.I18N_MESSAGES=${json};
window.t=function(text,params){var M=window.I18N_MESSAGES,s=M[text];if(!s&&typeof text==='string'){for(var k in M){if(k.slice(-2)===': '&&M[k]&&text.indexOf(k)===0&&(!s||k.length>s.k.length)){s={k:k};}}s=s?M[s.k]+text.slice(s.k.length):text;}if(params){s=s.replace(/\\{(\\w+)\\}/g,function(m,k){return params[k]!==undefined&&params[k]!==null?String(params[k]):m;});}return s;};`;
  catalogVersion[lang] = crypto.createHash('sha1').update(scripts[lang]).digest('hex').slice(0, 10);
}

router.get('/:lang.js', (req, res) => {
  const script = scripts[req.params.lang];
  if (!script) return res.status(404).end();
  res.type('application/javascript');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(script);
});

export default router;
