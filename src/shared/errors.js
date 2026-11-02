// Typed errors thrown by the service layer. Controllers catch these and map
// err.code to the appropriate presentation (flash+redirect for the frontend,
// an HTTP status for the API via handleServiceError). Anything else (DB errors,
// bugs) is a plain Error and falls through to each controller's existing 500 branch.

export class ServiceError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
    this.template = message; // untranslated English key (see withParams)
    this.params = undefined;
  }

  // Message with {placeholders}: the English template stays the i18n key,
  // err.message gets the values filled in (what the API returns).
  //   throw new ConflictError("System ID '{id}' already exists").withParams({ id })
  withParams(params) {
    this.params = params;
    this.message = this.template.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
    return this;
  }
}

export class ValidationError extends ServiceError {
  constructor(message, details) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = 'Invalid credentials') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ServiceUnavailableError extends ServiceError {
  constructor(message = 'Service unavailable', details) {
    super(message, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

export const HTTP_STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SERVICE_UNAVAILABLE: 503
};
