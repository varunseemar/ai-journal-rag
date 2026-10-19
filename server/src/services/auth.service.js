import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import * as userRepo from '../repositories/userRepo.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';

// Cost 10 = 2^10 hashing rounds: slow enough to make brute force expensive, fast enough for login.
const BCRYPT_ROUNDS = 10;

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password"
// and response times don't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const INVALID_CREDENTIALS = 'Invalid email or password';

function signToken(userId) {
  // The token carries only the user id (as the standard `sub` claim), nothing secret.
  return jwt.sign({}, config.jwt.secret, {
    subject: userId,
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256',
  });
}

// Returns the user id inside a valid token. Throws on a bad signature, expiry or wrong algorithm.
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (!payload.sub) throw new Error('Token has no subject');
    return payload.sub;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function signup(email, password) {
  // Email format and password rules were already checked by signupSchema (schemas.js).
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const user = await userRepo.create(email, passwordHash);
    return { token: signToken(user.id), user };
  } catch (err) {
    // 23505 = unique_violation on users.email
    if (err.code === '23505') {
      throw new ConflictError('An account with this email already exists', {
        email: ['An account with this email already exists. Try logging in instead.'],
      });
    }
    throw err;
  }
}

export async function login(email, password) {
  const user = await userRepo.findByEmailWithHash(email);
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw new UnauthorizedError(INVALID_CREDENTIALS);
  return { token: signToken(user.id), user: { id: user.id, email: user.email } };
}

export async function getUser(userId) {
  const user = await userRepo.findById(userId);
  // A valid token for a deleted user is treated like an invalid token.
  if (!user) throw new UnauthorizedError('Account no longer exists');
  return user;
}
