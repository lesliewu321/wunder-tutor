import { describe, expect, it } from 'vitest';
import { assessZh, type AzureZhResponse } from '../speech/zh/assess';

// Mandarin word-clip checks: a character's clip is scored as the real character (the yardstick) and as the likely
// mistake. Only a clean yardstick may judge — a glitch or a different reading must never flag correct speech.

const T = 10_000;
const ch = (c: string, label: string, score: number, from: number) => ({
  Word: c, AccuracyScore: score, ErrorType: 'None', Offset: from * T, Duration: 300 * T,
  Phonemes: [{ Phoneme: label, AccuracyScore: score, Offset: from * T, Duration: 300 * T }],
});
const MAIN: AzureZhResponse = { RecognitionStatus: 'Success', NBest: [{ AccuracyScore: 88, Words: [ch('这', 'zhe 4', 90, 100), ch('是', 'shi 4', 86, 450)] }] };
const clip = (c: string, label: string, score: number): AzureZhResponse => ({ RecognitionStatus: 'Success', NBest: [{ AccuracyScore: score, Words: [ch(c, label, score, 0)] }] });
const judge = (base: AzureZhResponse) => assessZh(MAIN, { text: '这是', py: 'zhe4 shi4' }, {
  durationMs: 900, alts: [{ index: 1, py: 'si4', char: '四', part: 'initial', json: clip('四', 'si 4', 93), base }],
}).words[1].syllables[0].zh!;

describe('Mandarin word-clip checks', () => {
  it('names the mistake when the clip clearly fits it better', () => {
    expect(judge(clip('是', 'shi 4', 70)).heardAs).toBe('si4');
  });
  it('ignores a clip the scorer could not score (a glitch is not a zero)', () => {
    expect(judge({ RecognitionStatus: 'Success', NBest: [{ Words: [] }] }).heardAs).toBeUndefined();
    expect(judge({ RecognitionStatus: 'NoMatch' }).heardAs).toBeUndefined();
  });
  it('ignores a clip the scorer read as a different syllable or tone out of context', () => {
    expect(judge(clip('是', 'shi 3', 70)).heardAs).toBeUndefined();
  });
});
