// Turns text into vectors with a small sentence-embedding model that runs inside this Node process
// (ONNX runtime via transformers.js): no API key, no cost, and journal text never leaves the server.
//
// Interface used by the rest of the app: embed(texts) -> number[][]. A hosted embedding API could
// replace this file without touching the callers, as long as it returns vectors of the same size.
// Changing the model means re-embedding every stored chunk: vectors from different models
// are not comparable.
import { pipeline } from '@huggingface/transformers';
import { config } from '../../config/env.js';
import { log } from '../../utils/logger.js';

let extractorPromise = null;

// Lazy singleton: the model is downloaded (~23 MB, once, then cached) and loaded on first use.
function getExtractor() {
  if (!extractorPromise) {
    // dtype 'q8' = the 8-bit quantised weights: about 4x smaller than fp32 with near-identical vectors.
    extractorPromise = pipeline('feature-extraction', config.embedding.model, { dtype: 'q8' }).catch(
      (err) => {
        extractorPromise = null; // allow a retry on the next call
        throw err;
      },
    );
  }
  return extractorPromise;
}

export async function embed(texts) {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  // pooling 'mean': average the per-token vectors into one vector per text.
  // normalize: scale every vector to length 1, so cosine similarity is just a dot product.
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  const vectors = output.tolist();
  if (vectors[0].length !== config.embedding.dimensions) {
    throw new Error(
      `Embedding model returned ${vectors[0].length} dimensions, expected ${config.embedding.dimensions}`,
    );
  }
  return vectors;
}

export async function embedOne(text) {
  const [vector] = await embed([text]);
  return vector;
}

// Called at boot so the first real request doesn't wait for the model download.
export async function warmUp() {
  const started = Date.now();
  await embed(['warm-up']);
  log.info(`Embedding model ready: ${config.embedding.model} (${config.embedding.dimensions}d)`, {
    ms: Date.now() - started,
  });
}
