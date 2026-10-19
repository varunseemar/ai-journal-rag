// One place that turns errors into JSON. Every error response has the same shape:
// { "error": { "code": "NOT_FOUND", "message": "...", "details"?: {...} } }
import { AppError } from '../utils/errors.js';
import { log } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// Express recognises error middleware by its four arguments, so `_next` must stay.
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Errors raised by express.json()
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body is too large' } });
    return;
  }

  log.error(`${req.method} ${req.path} failed`, { message: err.message, stack: err.stack });
  // Never send internal details (SQL errors, stack traces) to the client.
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
