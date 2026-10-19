-- Applied by `npm run db:migrate`. Every statement is idempotent (IF NOT EXISTS),
-- so running it again is harmless.

CREATE EXTENSION IF NOT EXISTS vector;  -- turns on pgvector

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,            -- stored lower-cased
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (length(content) BETWEEN 1 AND 10000),
  entry_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)                            -- target for the chunks foreign key below
);
CREATE INDEX IF NOT EXISTS entries_user_date_idx ON entries (user_id, entry_date DESC);

-- Derived data: each entry is split into chunks and every chunk gets an embedding.
-- Can always be rebuilt from `entries`.
CREATE TABLE IF NOT EXISTS chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL,
  user_id         uuid NOT NULL,
  chunk_index     int  NOT NULL,
  text            text NOT NULL,                  -- raw chunk text, for display / prompts
  entry_date      date NOT NULL,
  embedding       vector(384) NOT NULL,           -- must match EMBEDDING_DIMENSIONS
  embedding_model text NOT NULL,                  -- lets us find and re-embed rows if the model changes
  -- Composite FK: Postgres rejects a chunk whose user_id differs from its entry's owner,
  -- and deleting the entry deletes its chunks (delete sync for free).
  FOREIGN KEY (entry_id, user_id) REFERENCES entries (id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chunks_user_idx ON chunks (user_id);
CREATE INDEX IF NOT EXISTS chunks_entry_idx ON chunks (entry_id);
-- ANN index for cosine distance; vector_cosine_ops must match the <=> operator used in queries.
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
