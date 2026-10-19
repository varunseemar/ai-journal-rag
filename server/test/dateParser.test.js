import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDateRange } from '../src/services/rag/dateParser.js';

// Sunday, 18 October 2026
const TODAY = '2026-10-18';
const range = (question) => {
  const result = parseDateRange(question, TODAY);
  return result && [result.from, result.to];
};

describe('parseDateRange', () => {
  it('returns null when the question has no date', () => {
    assert.equal(range('What book am I reading?'), null);
    assert.equal(range('May I know my 5 km running time?'), null);
    assert.equal(range('Did I run a marathon?'), null);
  });

  it('reads explicit day + month, with or without a year', () => {
    assert.deepEqual(range('What did I eat for breakfast on 1 October?'), ['2026-10-01', '2026-10-01']);
    assert.deepEqual(range('what happened on 15th of September 2026'), ['2026-09-15', '2026-09-15']);
    assert.deepEqual(range('What did I do on October 2nd?'), ['2026-10-02', '2026-10-02']);
    assert.deepEqual(range('notes from 6 Aug 2025'), ['2025-08-06', '2025-08-06']);
    assert.deepEqual(range('on 2026-09-02'), ['2026-09-02', '2026-09-02']);
  });

  it('resolves a day + month in the future to last year (journals look back)', () => {
    assert.deepEqual(range('What did I do on 13 November?'), ['2025-11-13', '2025-11-13']);
  });

  it('ignores impossible dates', () => {
    assert.equal(range('on 31 February'), null);
    assert.equal(range('on 2026-02-30'), null);
  });

  it('handles today, yesterday and N days ago', () => {
    assert.deepEqual(range('What did I do today?'), [TODAY, TODAY]);
    assert.deepEqual(range('What did I do yesterday?'), ['2026-10-17', '2026-10-17']);
    assert.deepEqual(range('the day before yesterday'), ['2026-10-16', '2026-10-16']);
    assert.deepEqual(range('3 days ago'), ['2026-10-15', '2026-10-15']);
  });

  it('resolves weekdays to their most recent occurrence', () => {
    assert.deepEqual(range('What did I eat on Wednesday?'), ['2026-10-14', '2026-10-14']);
    assert.deepEqual(range('What did I do on Sunday?'), ['2026-10-18', '2026-10-18']);
    assert.deepEqual(range('What did I do last Sunday?'), ['2026-10-11', '2026-10-11']);
  });

  it('handles weeks (Monday to Sunday)', () => {
    assert.deepEqual(range('What did I do this week?'), ['2026-10-12', '2026-10-18']);
    assert.deepEqual(range('What did I do last week?'), ['2026-10-05', '2026-10-11']);
    assert.deepEqual(range('in the past 7 days'), ['2026-10-12', '2026-10-18']);
  });

  it('handles months and years', () => {
    assert.deepEqual(range('What did I do in September?'), ['2026-09-01', '2026-09-30']);
    assert.deepEqual(range('What did I do in November?'), ['2025-11-01', '2025-11-30']);
    assert.deepEqual(range('in August 2025'), ['2025-08-01', '2025-08-31']);
    assert.deepEqual(range('What happened last month?'), ['2026-09-01', '2026-09-30']);
    assert.deepEqual(range('this month'), ['2026-10-01', TODAY]);
    assert.deepEqual(range('What did I do last year?'), ['2025-01-01', '2025-12-31']);
    assert.deepEqual(range('in 2025'), ['2025-01-01', '2025-12-31']);
  });

  it('prefers the most specific date in the question', () => {
    assert.deepEqual(range('last week, on 15 October, what did I eat?'), ['2026-10-15', '2026-10-15']);
  });
});
