// A tiny tagged logger. Each pipeline stage gets its own coloured tag ([RAG], [LLM], [INGEST])
// so the retrieval steps are easy to follow in the terminal (and in the demo video).
const COLORS = { info: 36, ingest: 32, rag: 35, llm: 33, warn: 33, error: 31 };
const useColor = process.stdout.isTTY;

function write(tag, message, meta) {
  const time = new Date().toISOString().slice(11, 23);
  const label = useColor ? `\x1b[${COLORS[tag]}m[${tag.toUpperCase()}]\x1b[0m` : `[${tag.toUpperCase()}]`;
  const extra = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  const out = tag === 'error' ? console.error : console.log;
  out(`${time} ${label} ${message}${extra}`);
}

export const log = Object.fromEntries(
  Object.keys(COLORS).map((tag) => [tag, (message, meta) => write(tag, message, meta)]),
);
