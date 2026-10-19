// Retrieval: embed the question, then run a similarity search over THIS user's chunks only.
//
// Date-aware: if the question names a date or period ("on 1 October", "last week"), search only
// entries from that period first. Vector similarity alone is weak at exact values like dates.
// If that period has no entries, fall back to normal semantic search and say so in the result.
import { config } from '../../config/env.js';
import * as chunkRepo from '../../repositories/chunkRepo.js';
import { log } from '../../utils/logger.js';
import { embedOne } from '../embeddings/embedder.js';
import { parseDateRange } from './dateParser.js';

// Returns { chunks, dateRange, dateMatched }:
//   dateRange   - the period found in the question, or null
//   dateMatched - true when the chunks come from that period
export async function retrieve(userId, question, { today }) {
  const started = Date.now();
  const queryVector = await embedOne(question);
  log.rag(`question embedded (${queryVector.length}d)`, { ms: Date.now() - started });

  const search = (dateRange) =>
    chunkRepo.searchSimilar(userId, queryVector, {
      topK: config.rag.topK,
      efSearch: config.rag.efSearch,
      dateRange,
    });

  const dateRange = parseDateRange(question, today);
  let rows = [];
  let chunks = [];

  if (dateRange) {
    const searchStarted = Date.now();
    rows = await search(dateRange);
    // The user explicitly asked about this period, so every match from it is relevant context,
    // even if its wording scores low against the question.
    chunks = rows;
    log.rag(
      `date in question: "${dateRange.phrase}" -> ${dateRange.from}..${dateRange.to}; ` +
        `vector search WHERE user_id=${userId} AND entry_date in range: ${rows.length} chunk(s)`,
      { ms: Date.now() - searchStarted },
    );
    if (rows.length === 0) log.rag('no entries in that period: falling back to semantic search');
  }

  const dateMatched = chunks.length > 0;
  if (!dateMatched) {
    const searchStarted = Date.now();
    rows = await search(null);
    chunks = rows.filter((row) => row.score >= config.rag.minScore);
    log.rag(
      `vector search WHERE user_id=${userId}: ${rows.length} nearest chunks, ${chunks.length} above min score ${config.rag.minScore}`,
      { ms: Date.now() - searchStarted },
    );
  }

  // Defence in depth: the SQL already filters by user_id, so this should never fire.
  // If a future bug breaks that, fail loudly instead of leaking someone else's notes.
  const foreign = rows.filter((row) => row.userId !== userId);
  if (foreign.length > 0) {
    log.error('ISOLATION VIOLATION: retrieved chunks owned by another user', {
      userId,
      chunkIds: foreign.map((row) => row.id),
    });
    throw new Error('Retrieval returned data owned by another user');
  }

  rows.forEach((row, i) => {
    const kept = chunks.includes(row) ? 'keep' : 'drop';
    const preview = row.text.replace(/\s+/g, ' ').slice(0, 60);
    log.rag(`  #${i + 1} ${kept} score=${row.score.toFixed(3)} date=${row.entryDate} "${preview}..."`);
  });

  return { chunks, dateRange, dateMatched };
}
