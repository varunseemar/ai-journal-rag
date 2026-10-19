import { Router } from 'express';
import { chat } from '../controllers/chat.controller.js';
import { chatLimiter } from '../middleware/rateLimits.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { chatBodySchema } from '../schemas.js';

export const chatRoutes = Router();

chatRoutes.post('/', requireAuth, chatLimiter, validate(chatBodySchema), chat);
