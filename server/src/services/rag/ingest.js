// Ingestion step 1 + 2: text -> chunks -> vectors. No database writes here; entry.service stores
// the result inside a transaction. Both create and update go through this one function.
import { formatLongDate } from '../../utils/dates.js';
import { embed } from '../embeddings/embedder.js';
import { chunkText } from './chunker.js';

// The date is embedded together with the text. Plain embeddings know nothing about when something
// happened, so this is what lets "what did I do on Tuesday?" match Tuesday's entry.
export function withDateHeader(chunk, entryDate) {
  return `Journal entry from ${formatLongDate(entryDate)}:\n${chunk}`;
}

export async function prepareChunks(content, entryDate) {
  const pieces = chunkText(content);
  const vectors = await embed(pieces.map((piece) => withDateHeader(piece, entryDate)));
  // `text` keeps the raw chunk (no header) for showing to the user and building prompts.
  return pieces.map((text, i) => ({ chunkIndex: i, text, embedding: vectors[i] }));
}
