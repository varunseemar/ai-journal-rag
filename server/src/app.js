// Builds the Express app (middleware + routes) without starting it, so it can be imported by tests.
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { entriesRoutes } from './routes/entries.routes.js';
import { llm } from './services/llm/llmClient.js';

export function createApp() {
  const app = express();

  // Render (and most hosts) put a proxy in front of the app; trust its X-Forwarded-For header
  // so rate limiting sees the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '100kb' }));

  // Public health check. Handy in the demo to show which LLM provider is active.
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      llmProvider: llm.provider,
      llmModel: llm.model,
      embeddingModel: config.embedding.model,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entriesRoutes);
  app.use('/api/chat', chatRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
