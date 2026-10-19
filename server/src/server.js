// Entry point: the side effects live here (DB check, model warm-up, listening on a port).
import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { warmUp } from './services/embeddings/embedder.js';
import { llm } from './services/llm/llmClient.js';
import { log } from './utils/logger.js';

try {
  await pool.query('SELECT 1');
  log.info('Postgres connected');
} catch (err) {
  log.error('Could not connect to Postgres. Check DATABASE_URL in server/.env', { message: err.message });
  process.exit(1);
}

log.info(`LLM provider: ${llm.provider}, model: ${llm.model}, base URL: ${llm.baseURL}`);
if (llm.fallbackModels.length > 0) log.info(`LLM fallback models: ${llm.fallbackModels.join(', ')}`);

const server = createApp().listen(config.port, () => {
  log.info(`API listening on http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log.error(`Port ${config.port} is already in use. Is another copy of the API still running?`);
  } else {
    log.error('HTTP server error', { message: err.message });
  }
  process.exit(1);
});

// Load the embedding model in the background so the first request doesn't wait for it.
warmUp().catch((err) => log.error('Embedding model failed to load', { message: err.message }));

function shutdown(signal) {
  log.info(`${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
