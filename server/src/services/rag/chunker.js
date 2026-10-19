// Splits journal text into chunks small enough for the embedding model.
// Pure function (text in, array out): no I/O, so it is unit-tested in test/chunker.test.js.
//
// Why 800 characters: all-MiniLM-L6-v2 reads at most 256 word-pieces (~1,000 characters of English)
// and silently ignores the rest. 800 + the ~45-character date header added in ingest.js stays
// under that limit while still holding a complete thought.
export const DEFAULT_MAX_CHARS = 800;

// Overlap carried into the next chunk is capped so it never crowds out new content.
const MAX_OVERLAP_CHARS = 200;

export function chunkText(text, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const clean = normalize(text);
  if (!clean) return [];
  // Most journal entries are short: keep them whole. Splitting would only lose context.
  if (clean.length <= maxChars) return [clean];

  const units = toUnits(clean, maxChars);
  const chunks = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? current + unit.joiner + unit.text : unit.text;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    chunks.push(current);
    // Start the next chunk with the previous chunk's last sentence, so a fact that straddles
    // the boundary still appears together with its context in one chunk.
    const overlap = lastSentence(current);
    const useOverlap =
      overlap &&
      overlap !== current &&
      overlap.length <= MAX_OVERLAP_CHARS &&
      overlap.length + 1 + unit.text.length <= maxChars;
    current = useOverlap ? `${overlap} ${unit.text}` : unit.text;
  }
  if (current) chunks.push(current);
  return chunks;
}

function normalize(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Break the text into pieces that each fit in a chunk, following the text's own boundaries:
// paragraphs first, then sentences for oversized paragraphs, then words for a giant sentence.
// `joiner` remembers how a piece was attached to the previous one, so packing preserves layout.
function toUnits(text, maxChars) {
  const units = [];
  for (const paragraph of text.split(/\n\n+/)) {
    if (paragraph.length <= maxChars) {
      units.push({ text: paragraph, joiner: '\n\n' });
      continue;
    }
    splitSentences(paragraph).forEach((sentence, i) => {
      const joiner = i === 0 ? '\n\n' : ' ';
      if (sentence.length <= maxChars) {
        units.push({ text: sentence, joiner });
      } else {
        splitWords(sentence, maxChars).forEach((piece, j) => {
          units.push({ text: piece, joiner: j === 0 ? joiner : ' ' });
        });
      }
    });
  }
  return units;
}

function splitSentences(paragraph) {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitWords(sentence, maxChars) {
  const pieces = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    if (current && current.length + 1 + word.length > maxChars) {
      pieces.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) pieces.push(current);
  // A single "word" longer than maxChars (e.g. a pasted URL) is cut into fixed slices.
  return pieces.flatMap((piece) =>
    piece.length <= maxChars ? [piece] : piece.match(new RegExp(`[\\s\\S]{1,${maxChars}}`, 'g')),
  );
}

function lastSentence(text) {
  const sentences = splitSentences(text.replace(/\n+/g, ' '));
  return sentences.at(-1) ?? '';
}
