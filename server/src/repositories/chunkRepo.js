// All SQL for the chunks table, including the vector similarity search.
import { pool, withTransaction } from '../db/pool.js';
import { log } from '../utils/logger.js';
import { assertUserId } from './assertUserId.js';

// pgvector accepts the text form '[0.1,-0.2,...]', which is exactly what JSON.stringify produces.
const toVectorLiteral = (vector) => JSON.stringify(vector);

// Replaces all chunks of one entry. Called inside the same transaction as the entry write,
// so the entry and its vectors can never get out of sync.
export async function replaceForEntry(userId, entryId, { entryDate, chunks, embeddingModel }, db = pool) {
  assertUserId(userId);
  await db.query(`DELETE FROM chunks WHERE entry_id = $1 AND user_id = $2`, [entryId, userId]);
  for (const chunk of chunks) {
    await db.query(
      `INSERT INTO chunks (entry_id, user_id, chunk_index, text, entry_date, embedding, embedding_model)
       VALUES ($1, $2, $3, $4, $5, $6::vector, $7)`,
      [entryId, userId, chunk.chunkIndex, chunk.text, entryDate, toVectorLiteral(chunk.embedding), embeddingModel],
    );
  }
}

// hnsw.iterative_scan exists from pgvector 0.8. On older versions setting it is an error,
// so check the installed version once and remember the answer.
let iterativeScanSupported;
async function supportsIterativeScan(db) {
  if (iterativeScanSupported === undefined) {
    const { rows } = await db.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
    const [major = 0, minor = 0] = (rows[0]?.extversion ?? '0.0').split('.').map(Number);
    iterativeScanSupported = major > 0 || minor >= 8;
    log.info(`pgvector ${rows[0]?.extversion}: iterative index scans ${iterativeScanSupported ? 'on' : 'off'}`);
  }
  return iterativeScanSupported;
}

// Semantic search over ONE user's chunks, optionally limited to a date range.
// `WHERE user_id = $1` is part of the same statement as the similarity ranking, so Postgres can
// only ever return this user's rows, whichever plan (B-tree or HNSW) it picks.
export async function searchSimilar(userId, queryVector, { topK, efSearch, dateRange = null }) {
  assertUserId(userId);
  // Both variants are fixed SQL text; the dates themselves are passed as parameters ($4, $5).
  const dateFilter = dateRange ? 'AND entry_date BETWEEN $4 AND $5' : '';
  const params = [userId, toVectorLiteral(queryVector), topK];
  if (dateRange) params.push(dateRange.from, dateRange.to);

  return withTransaction(async (client) => {
    // set_config(..., true) == SET LOCAL: the setting lasts only for this transaction.
    await client.query(`SELECT set_config('hnsw.ef_search', $1, true)`, [String(efSearch)]);
    if (await supportsIterativeScan(client)) {
      // Keep scanning the HNSW graph until enough rows pass the user_id filter.
      await client.query(`SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`);
    }

    const { rows } = await client.query(
      `SELECT id,
              entry_id    AS "entryId",
              user_id     AS "userId",
              entry_date  AS "entryDate",
              chunk_index AS "chunkIndex",
              text,
              1 - (embedding <=> $2::vector) AS score
       FROM chunks
       WHERE user_id = $1 ${dateFilter}
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      params,
    );
    // relaxed_order may return rows slightly out of order, so sort by score again.
    return rows.sort((a, b) => b.score - a.score);
  });
}
