import { ServiceError, HTTP_STATUS_BY_CODE } from './errors.js';

export function handleServiceError(err, res) {
  if (err instanceof ServiceError) {
    return res.status(HTTP_STATUS_BY_CODE[err.code] || 400).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
}

// Some older API controllers (IP address, Subnet, Domain) respond with a
// plain { error: message } envelope instead of { success, message }. This
// preserves that existing response shape while still mapping ServiceError
// codes to the right HTTP status, so those controllers don't have to
// duplicate the status-mapping logic.
export function handleServiceErrorPlain(err, res) {
  if (err instanceof ServiceError) {
    return res.status(HTTP_STATUS_BY_CODE[err.code] || 400).json({ error: err.message });
  }
  return res.status(500).json({ error: err.message });
}

// ===== REST controller building blocks =====

// Username stored in updated_by for API changes
export const apiActor = (req) => req.user?.username || 'api-user';

// ?search=&page=&pageSize= (pageSize capped at 100)
export function apiPage(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(parseInt(query.pageSize, 10) || 10, 100));
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  return { search, page, pageSize };
}

// { data, pagination } envelope of the list endpoints
export function paginated(items, totalCount, page, pageSize) {
  const totalPages = Math.ceil(totalCount / pageSize);
  return { data: items, pagination: { page, pageSize, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 } };
}

// Wraps an async handler; errors go to onError (ServiceError -> HTTP status).
export const apiHandler = (fn, onError = handleServiceErrorPlain) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    onError(err, res);
  }
};

// GET /:id, POST /, PUT /:id, DELETE /:id over a service's get/create/update/delete
export function crudHandlers({ get, create, update, remove }, onError = handleServiceErrorPlain) {
  return {
    getById: apiHandler(async (req, res) => res.json(await get(req.params.id)), onError),
    create: apiHandler(async (req, res) => res.status(201).json(await create({ ...req.body, updated_by: apiActor(req) })), onError),
    update: apiHandler(async (req, res) => res.json(await update(req.params.id, { ...req.body, updated_by: apiActor(req) })), onError),
    remove: apiHandler(async (req, res) => { await remove(req.params.id); res.status(204).end(); }, onError),
  };
}
