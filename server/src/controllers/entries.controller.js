// Every call passes req.userId (from the verified JWT), never an id from the request.
import * as entryService from '../services/entry.service.js';

export async function list(req, res) {
  res.json({ entries: await entryService.list(req.userId) });
}

export async function create(req, res) {
  res.status(201).json(await entryService.create(req.userId, req.body));
}

export async function update(req, res) {
  res.json(await entryService.update(req.userId, req.params.id, req.body));
}

export async function remove(req, res) {
  await entryService.remove(req.userId, req.params.id);
  res.status(204).end();
}
