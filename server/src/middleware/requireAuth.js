// The ONLY place a user's identity is established: from a verified JWT.
// Controllers read req.userId and never trust an id sent in the body, query or URL.
import { verifyToken } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';

export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedError('Missing bearer token');
  req.userId = verifyToken(token); // throws 401 on a bad or expired token
  next();
}
