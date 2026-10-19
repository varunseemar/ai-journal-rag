import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimits.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, signupSchema } from '../schemas.js';

export const authRoutes = Router();

// Sign-up enforces password strength; log-in only checks the fields are present and sane.
authRoutes.post('/signup', authLimiter, validate(signupSchema), auth.signup);
authRoutes.post('/login', authLimiter, validate(loginSchema), auth.login);
authRoutes.get('/me', requireAuth, auth.me);
