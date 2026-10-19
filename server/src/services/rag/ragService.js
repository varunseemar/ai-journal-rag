// The whole RAG pipeline: retrieve -> (nothing relevant? short reply) -> build prompt -> stream.
// An async generator of events, so the chat controller only has to forward them as SSE.
import { log } from '../../utils/logger.js';
import { llm } from '../llm/llmClient.js';
import { describeRange } from './dateParser.js';
import { buildMessages } from './promptBuilder.js';
import { retrieve } from './retriever.js';

export const NO_RESULTS_MESSAGE =
  "I couldn't find anything about that in your journal. Try rephrasing, or add an entry about it first.";

export async function* answerQuestion(userId, question, { today, signal }) {
  const started = Date.now();

  // 1. Retrieval (date-aware: see retriever.js)
  const { chunks, dateRange, dateMatched } = await retrieve(userId, question, { today });

  // Sources are sent before any tokens, from our own retrieval: always accurate,
  // even if the model forgets to cite.
  yield {
    event: 'sources',
    data: chunks.map((chunk, i) => ({
      n: i + 1,
      entryId: chunk.entryId,
      entryDate: chunk.entryDate,
      snippet: chunk.text.slice(0, 160),
      score: Number(chunk.score.toFixed(3)),
    })),
  };

  // Nothing relevant: don't call the LLM. Avoids a made-up answer and saves free quota.
  if (chunks.length === 0) {
    log.rag('no relevant chunks: skipping the LLM call');
    const message = dateRange
      ? `I couldn't find any journal entries from ${describeRange(dateRange)} about that.`
      : NO_RESULTS_MESSAGE;
    yield { event: 'token', data: { t: message } };
    yield { event: 'done', data: { provider: null, model: null, ms: Date.now() - started } };
    return;
  }

  // 2. Augment: put the excerpts into the prompt
  const messages = buildMessages(question, chunks, { today, dateRange, dateMatched });
  log.llm(`sending ${chunks.length} excerpts to ${llm.provider}`, {
    model: llm.model,
    promptChars: messages.reduce((sum, m) => sum + m.content.length, 0),
  });

  // 3. Generation, streamed token by token
  let model = llm.model;
  const onModel = (servedBy) => {
    model = servedBy;
  };
  for await (const text of llm.streamChat(messages, { signal, onModel })) {
    yield { event: 'token', data: { t: text } };
  }
  yield { event: 'done', data: { provider: llm.provider, model, ms: Date.now() - started } };
}
