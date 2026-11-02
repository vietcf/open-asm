// REST API debug log: while the api_debug_log setting is on (System
// Configuration > Security & Logs, default off), every /api/v1 request is
// written to system_log once the response is sent, level 'debug', action
// 'api_request': method, URL, status, duration and the JSON request body, so
// what an integration (e.g. a load-balancer sync) actually sends can be checked.
//
// Values of secret-looking keys (password, token, secret, OTP, API key,
// authorization) are masked at any depth; the body is cut after MAX_BODY
// characters. Meant to be switched on while debugging, not left on.
import { writeLog, isApiDebugLogOn } from '../utils/logHelper.js';
import { describeRequest } from './auditLog.middleware.js';

const MAX_BODY = 16000;
const SECRET_KEY = /pass(word)?|secret|token|otp|api[_-]?key|authorization|credential/i;

function mask(value) {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) && v != null && v !== '' ? '***' : mask(v)]));
  }
  return value;
}

function bodyText(body) {
  if (body == null || (typeof body === 'object' && !Object.keys(body).length)) return '';
  const text = JSON.stringify(mask(body), null, 2);
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}\n... (${text.length - MAX_BODY} more characters)` : text;
}

export default function apiDebugLog(req, res, next) {
  const started = process.hrtime.bigint();
  isApiDebugLogOn().then((on) => {
    if (on) {
      res.on('finish', () => {
        const ms = Number((process.hrtime.bigint() - started) / 1000000n);
        const { object_type, object_id } = describeRequest(req.method, req.baseUrl + req.path);
        const body = bodyText(req.body);
        writeLog({
          req,
          action: 'api_request',
          object_type,
          object_id,
          status: res.statusCode >= 400 ? 'failed' : 'success',
          category: 'app',
          level: 'debug',
          description: `${req.method} ${req.originalUrl} (${res.statusCode}, ${ms} ms)${body ? '\n' + body : ''}`,
        }).catch((err) => console.error('API debug log failed:', err.message));
      });
    }
    next();
  }, next);
}
