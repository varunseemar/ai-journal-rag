// validate(schema) checks req.body (or req.params) against a zod schema and returns 400 with
// field errors if it doesn't match. Controllers then only ever see clean, typed data.
import { BadRequestError } from '../utils/errors.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new BadRequestError('Invalid request', result.error.flatten().fieldErrors);
    }
    if (source === 'body') req.body = result.data; // trimmed / lower-cased values
    next();
  };
