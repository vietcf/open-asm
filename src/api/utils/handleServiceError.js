import { ServiceError, HTTP_STATUS_BY_CODE } from '../../services/errors.js';

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
