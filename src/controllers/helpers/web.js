// Small helpers shared by the web (EJS) controllers.
import { ServiceError } from '../../services/errors.js';

// Username to store in updated_by columns
export const actorName = (req) => req.session?.user?.username || null;
export const actorId = (req) => req.session?.user?.id || null;

// page / pageSize / search from the query string, validated against the
// configured page size options.
export function parseListQuery(req, res) {
  const allowed = res.locals.pageSizeOptions || [10, 20, 50];
  let pageSize = parseInt(req.query.pageSize, 10);
  if (!allowed.includes(pageSize)) pageSize = res.locals.defaultPageSize || allowed[0];
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  return { page, pageSize, search };
}

// Multi-value query parameter: accepts "x[]" and "x", returns non-empty strings.
export function queryList(query, name) {
  const raw = query[`${name}[]`] ?? query[name];
  const arr = Array.isArray(raw) ? raw : (raw === undefined || raw === null ? [] : [raw]);
  return arr.map(v => String(v).trim()).filter(Boolean);
}

export const queryValue = (query, name) => (query[name] === undefined ? '' : String(query[name]).trim());

export function totalPagesOf(totalCount, pageSize) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

// User-facing (translated) message for an error thrown by a service.
// Unexpected errors are logged and shown as a generic message.
export function errorMessage(req, err, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ServiceError) return req.t(err.template, err.params);
  console.error(err);
  return req.t(fallback);
}

// One flash message per request, read by partials/ui/flash.ejs
export function takeFlash(req) {
  return {
    successMessage: (req.flash('success') || [])[0],
    errorMessage: (req.flash('error') || [])[0],
  };
}
