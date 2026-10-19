// Streams the RAG answer to the browser as Server-Sent Events:
//   sources -> token, token, ... -> done      (or `error` if something fails mid-stream)
import { answerQuestion } from '../services/rag/ragService.js';
import { todayIso } from '../utils/dates.js';
import { AppError } from '../utils/errors.js';
import { log } from '../utils/logger.js';
import { openSse } from '../utils/sse.js';

export async function chat(req, res) {
  const { question, today = todayIso() } = req.body;

  // If the user closes the tab or sends a new question, stop the LLM request:
  // no point spending quota on an answer nobody will read.
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const sse = openSse(res);
  log.rag(`question from user ${req.userId}: "${question}"`);

  try {
    for await (const { event, data } of answerQuestion(req.userId, question, { today, signal: abort.signal })) {
      sse.send(event, data);
    }
  } catch (err) {
    if (abort.signal.aborted) {
      log.llm('client disconnected: LLM request aborted');
      return;
    }
    // The HTTP status is already 200 once streaming starts, so errors travel inside the stream.
    log.error('chat failed', { message: err.message });
    sse.send('error', {
      message: err instanceof AppError ? err.message : 'Something went wrong while answering.',
    });
  } finally {
    sse.close();
  }
}
