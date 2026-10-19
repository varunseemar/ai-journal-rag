// Reads process.env exactly once, validates it and exports a frozen config object.
// Nothing else in the app touches process.env, so a missing or malformed variable
// stops the server at boot with a clear message instead of failing on some request later.
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required (Neon pooled connection string)' })
    .url(),

  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  LLM_PROVIDER: z.enum(['ollama', 'openrouter']).default('ollama'),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  // Comma-separated backup models (OpenRouter only), tried in order if LLM_MODEL fails.
  LLM_FALLBACK_MODELS: z.string().optional(),

  EMBEDDING_MODEL: z.string().default('Xenova/all-MiniLM-L6-v2'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),

  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  RAG_EF_SEARCH: z.coerce.number().int().min(1).max(1000).default(100),
  RAG_MIN_SCORE: z.coerce.number().min(-1).max(1).default(0.35),
});

// Treat `KEY=` (empty) the same as "not set", so optional values fall back to their defaults.
const raw = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
);

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
  port: env.PORT,
  clientOrigins: env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  databaseUrl: env.DATABASE_URL,
  jwt: Object.freeze({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN }),
  llm: Object.freeze({
    provider: env.LLM_PROVIDER,
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    fallbackModels: (env.LLM_FALLBACK_MODELS ?? '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
  }),
  embedding: Object.freeze({ model: env.EMBEDDING_MODEL, dimensions: env.EMBEDDING_DIMENSIONS }),
  rag: Object.freeze({ topK: env.RAG_TOP_K, efSearch: env.RAG_EF_SEARCH, minScore: env.RAG_MIN_SCORE }),
});
