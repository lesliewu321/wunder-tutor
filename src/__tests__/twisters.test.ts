import { describe, expect, it } from 'vitest';
import { ALL_TWISTERS, formatMs, TWISTER_PASS, TWISTERS, twisterItem, twisterResult, twistersFor } from '../content/twisters';
import type { Assessment } from '../domain/types';

// The tongue-twister game's rules: what counts as "said it right", what the time is, and which twisters may be played.

const assessment = (overall: number, words: { word: string; errorType: 'none' | 'omission' | 'mispronunciation' }[]): Assessment =>
  ({ overall, fluency: 90, completeness: 100, prosody: 90, words: words.map((w) => ({ ...w, score: 80, phonemes: [], syllables: [] })) } as unknown as Assessment);

describe('a tongue-twister take', () => {
  it('passes at the pass mark with every word said, and the time is the speech itself', () => {
    const r = twisterResult(assessment(TWISTER_PASS, [{ word: 'red', errorType: 'none' }, { word: 'lorry', errorType: 'none' }]), { analysis: { speechMs: 1834.4, durationMs: 3000 } as never });
    expect(r).toEqual({ passed: true, ms: 1834, score: TWISTER_PASS, missed: [] });
    expect(formatMs(r.ms)).toBe('1.83 s');
  });

  it('fails under the mark, and fails when a word was missed however high the score', () => {
    expect(twisterResult(assessment(TWISTER_PASS - 1, [{ word: 'red', errorType: 'none' }]), { analysis: { speechMs: 1000, durationMs: 1000 } as never }).passed).toBe(false);
    const r = twisterResult(assessment(95, [{ word: 'red', errorType: 'none' }, { word: 'lorry', errorType: 'omission' }]), { analysis: { speechMs: 900, durationMs: 1000 } as never });
    expect(r.passed).toBe(false);
    expect(r.missed).toEqual(['lorry']);
  });

  it('never trusts a time shorter than a word, and falls back to the whole recording', () => {
    expect(twisterResult(assessment(90, []), { analysis: { speechMs: 0, durationMs: 1500 } as never }).ms).toBe(1500);
    expect(twisterResult(assessment(90, []), { analysis: { speechMs: 10, durationMs: 10 } as never }).ms).toBe(200);
  });
});

describe('the twisters on offer', () => {
  it('are only the proven ones, and every twister has a unique id, a locale and a picture', () => {
    const ids = new Set(ALL_TWISTERS.map((t) => t.id));
    expect(ids.size).toBe(ALL_TWISTERS.length);
    for (const t of ALL_TWISTERS) { expect(t.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/); expect(t.picture).toBeTruthy(); expect([1, 2, 3]).toContain(t.level); }
    for (const t of TWISTERS) expect(t.proven).toBe(true);
    for (const t of twistersFor('en-US')) expect(t.locale).toBe('en-US');
  });

  it('becomes a line to speak, in its own language', () => {
    const en = twisterItem({ id: 'x', locale: 'en-US', text: 'Red lorry, yellow lorry.', picture: '🚚', sounds: ['r'], level: 1, proven: true });
    expect(en).toMatchObject({ id: 'tw-x', kind: 'sentence' });
    expect(en.lang).toBeUndefined();
    const zh = twisterItem({ id: 'y', locale: 'zh-CN', text: '四是四。', picture: '🔢', sounds: [], level: 1, proven: true });
    expect(zh.lang).toBe('zh-CN');
  });
});
