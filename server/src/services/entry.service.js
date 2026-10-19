// Entry CRUD + keeping each entry's vectors in sync with its text.
import { config } from '../config/env.js';
import { withTransaction } from '../db/pool.js';
import * as chunkRepo from '../repositories/chunkRepo.js';
import * as entryRepo from '../repositories/entryRepo.js';
import { todayIso } from '../utils/dates.js';
import { NotFoundError } from '../utils/errors.js';
import { log } from '../utils/logger.js';
import { prepareChunks } from './rag/ingest.js';

export function list(userId) {
  return entryRepo.listByUser(userId);
}

export async function create(userId, { content, entryDate = todayIso() }) {
  const started = Date.now();
  // Embed BEFORE touching the database: if embedding fails, nothing is half-written.
  const chunks = await prepareChunks(content, entryDate);

  const entry = await withTransaction(async (tx) => {
    const created = await entryRepo.create(userId, { content, entryDate }, tx);
    await chunkRepo.replaceForEntry(
      userId,
      created.id,
      { entryDate, chunks, embeddingModel: config.embedding.model },
      tx,
    );
    return created;
  });

  log.ingest(`entry ${entry.id} created: ${chunks.length} chunk(s) embedded and stored`, {
    user: userId,
    chars: content.length,
    ms: Date.now() - started,
  });
  return { entry, chunkCount: chunks.length };
}

export async function update(userId, entryId, { content, entryDate }) {
  const started = Date.now();
  const existing = await entryRepo.findById(userId, entryId);
  // Same 404 whether the entry doesn't exist or belongs to someone else.
  if (!existing) throw new NotFoundError('Entry not found');

  const date = entryDate ?? existing.entryDate;
  const chunks = await prepareChunks(content, date);

  const entry = await withTransaction(async (tx) => {
    const updated = await entryRepo.update(userId, entryId, { content, entryDate: date }, tx);
    if (!updated) throw new NotFoundError('Entry not found'); // deleted in the meantime
    // Old vectors are deleted and new ones inserted in the same transaction as the text change.
    await chunkRepo.replaceForEntry(
      userId,
      entryId,
      { entryDate: date, chunks, embeddingModel: config.embedding.model },
      tx,
    );
    return updated;
  });

  log.ingest(`entry ${entryId} updated: old chunks replaced by ${chunks.length} new chunk(s)`, {
    user: userId,
    ms: Date.now() - started,
  });
  return { entry, chunkCount: chunks.length };
}

export async function remove(userId, entryId) {
  const deleted = await entryRepo.remove(userId, entryId);
  if (!deleted) throw new NotFoundError('Entry not found');
  log.ingest(`entry ${entryId} deleted (its chunks removed by ON DELETE CASCADE)`, { user: userId });
}
