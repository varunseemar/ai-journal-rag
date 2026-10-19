import { rateLimit } from 'express-rate-limit';

const limited = (message) => ({ error: { code: 'RATE_LIMITED', message } });

// Slows down password guessing: 20 auth attempts per 15 minutes per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limited('Too many attempts. Try again in a few minutes.'),
});

// Protects the (free, limited) LLM quota: 20 questions per minute per user.
// Must run after requireAuth, because it keys on req.userId.
export const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.userId,
  message: limited('Too many questions. Wait a minute and try again.'),
});
