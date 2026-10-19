import { Router } from 'express';
import * as entries from '../controllers/entries.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { entryBodySchema, entryIdSchema } from '../schemas.js';

export const entriesRoutes = Router();

// Every entries route requires a logged-in user.
entriesRoutes.use(requireAuth);

entriesRoutes.get('/', entries.list);
entriesRoutes.post('/', validate(entryBodySchema), entries.create);
entriesRoutes.put('/:id', validate(entryIdSchema, 'params'), validate(entryBodySchema), entries.update);
entriesRoutes.delete('/:id', validate(entryIdSchema, 'params'), entries.remove);
