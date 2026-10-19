// Services throw these; middleware/errorHandler.js turns them into JSON responses.
// That keeps HTTP status codes out of the business logic.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details) {
    super(409, 'CONFLICT', message, details);
  }
}

// The LLM provider failed or could not be reached.
export class LlmError extends AppError {
  constructor(message = 'The language model is unavailable') {
    super(502, 'LLM_ERROR', message);
  }
}
