import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chunkText, DEFAULT_MAX_CHARS } from '../src/services/rag/chunker.js';

const sentence = (i) => `This is sentence number ${i} about my day and what I did.`;

describe('chunkText', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    assert.deepEqual(chunkText(''), []);
    assert.deepEqual(chunkText('   \n\n  '), []);
  });

  it('keeps a short entry as a single chunk', () => {
    const text = 'Had oatmeal with banana for breakfast, then went for a 5 km run.';
    assert.deepEqual(chunkText(text), [text]);
  });

  it('normalises whitespace', () => {
    assert.deepEqual(chunkText('  Hello   world \r\n\r\n\r\n\r\n Bye  '), ['Hello world\n\nBye']);
  });

  it('splits a long entry into several chunks, none over the limit', () => {
    const paragraphs = Array.from({ length: 6 }, (_, p) =>
      Array.from({ length: 5 }, (_, s) => sentence(p * 5 + s)).join(' '),
    );
    const chunks = chunkText(paragraphs.join('\n\n'));
    assert.ok(chunks.length > 1, 'expected more than one chunk');
    for (const chunk of chunks) assert.ok(chunk.length <= DEFAULT_MAX_CHARS, `chunk too long: ${chunk.length}`);
  });

  it('starts each chunk after the first with the last sentence of the previous chunk (overlap)', () => {
    const text = Array.from({ length: 40 }, (_, i) => sentence(i)).join(' ');
    const chunks = chunkText(text, { maxChars: 300 });
    assert.ok(chunks.length > 2);
    for (let i = 1; i < chunks.length; i += 1) {
      const previousSentences = chunks[i - 1].split(/(?<=[.!?])\s+/);
      assert.ok(chunks[i].startsWith(previousSentences.at(-1)), `chunk ${i} has no overlap`);
    }
  });

  it('keeps every sentence of the original text', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => sentence(i));
    const chunks = chunkText(sentences.join(' '), { maxChars: 300 });
    const joined = chunks.join(' ');
    for (const s of sentences) assert.ok(joined.includes(s), `lost: ${s}`);
  });

  it('splits a single giant sentence (no punctuation) on word boundaries', () => {
    const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, { maxChars: 200 });
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 200);
      assert.match(chunk, /^word\d+/, 'a chunk starts mid-word');
    }
  });
});
