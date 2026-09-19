import { afterEach, describe, expect, it, vi } from 'vitest';
import { AzurePronunciationProvider } from '../speech/azureProvider';
import { decodeWav, encodeWav } from '../speech/wav';
import type { AssessContext, Recording } from '../speech/types';

// The two-round check for phrases and sentences: the take is scored once, then only the checked word's clip is
// scored against the real word and its likely mistakes.

const TICKS = 10_000_000;
const word = (w: string, from: number, dur: number, score: number, phonemes: [string, number][]) => ({
  Word: w, Offset: from * TICKS, Duration: dur * TICKS, AccuracyScore: score, ErrorType: 'None', Phonemes: phonemes.map(([p, s]) => ({ Phoneme: p, AccuracyScore: s })),
});
const MAIN = {
  RecognitionStatus: 'Success',
  NBest: [{ AccuracyScore: 90, FluencyScore: 90, CompletenessScore: 100, PronScore: 90, Words: [
    word('i', 0.3, 0.2, 95, [['aɪ', 95]]),
    word('think', 0.6, 0.4, 88, [['θ', 86], ['ɪ', 90], ['ŋ', 90], ['k', 90]]),
    word('so', 1.1, 0.3, 95, [['s', 95], ['oʊ', 95]]),
  ] }],
};
const one = (w: string, score: number) => ({ RecognitionStatus: 'Success', NBest: [{ AccuracyScore: score, Words: [{ Word: w, AccuracyScore: score, ErrorType: 'None', Phonemes: [] }] }] });

const recording = (): Recording => {
  const pcm = new Float32Array(16000 * 2).map((_, i) => 0.3 * Math.sin(i / 7));
  return { wav: new Blob([encodeWav(pcm)], { type: 'audio/wav' }), pcm, pitch: null, analysis: { durationMs: 2000, speechMs: 1200, peak: 0.3, speechRms: 0.2, noiseRms: 0.001 }, simulated: false };
};
const ctx = { itemId: 'x', locale: 'en-US', accent: 'en-US', focus: ['θ'], homeLanguage: 'yue', band: 'junior', profileId: 'p', attemptIndex: 0 } as unknown as AssessContext;

afterEach(() => vi.unstubAllGlobals());

describe('checking likely mistakes on the word clip', () => {
  it('scores the take first, then only the checked word, and says what came out', async () => {
    const calls: { params: URLSearchParams; seconds: number }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const params = new URL(url, 'http://x').searchParams;
      const bytes = init.body instanceof Blob ? await init.body.arrayBuffer() : (init.body as ArrayBuffer);
      calls.push({ params, seconds: decodeWav(bytes)!.pcm.length / 16000 });
      // The clip of "think" fits "fink" far better than "think": that is what the learner said.
      const body = calls.length === 1 ? MAIN : { main: one('think', 60), alts: JSON.parse(params.get('alts')!).map((a: string) => one(a, a === 'fink' ? 92 : 55)) };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    const a = await new AzurePronunciationProvider().assess(recording(), 'I think so.', ctx);

    expect(calls[0].params.get('alts')).toBeNull(); // round 1: the take alone
    expect(calls).toHaveLength(2);
    expect(calls[1].params.get('text')).toBe('think'); // round 2: just the word…
    expect(JSON.parse(calls[1].params.get('alts')!)).toEqual(['fink', 'sink', 'tink']);
    expect(calls[1].seconds).toBeCloseTo(0.4 + 2 * 0.08, 2); // …as a clip with a small margin
    const theta = a.words[1].phonemes.find((p) => p.phoneme === 'θ')!;
    expect(theta.heardAs).toBe('f');
  });

  it('keeps the main score when a clip check fails', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? new Response(JSON.stringify(MAIN), { status: 200 }) : new Response('{}', { status: 502 }))));
    const a = await new AzurePronunciationProvider().assess(recording(), 'I think so.', ctx);
    expect(a.words.map((w) => w.word)).toEqual(['i', 'think', 'so']);
    expect(a.words[1].phonemes.find((p) => p.phoneme === 'θ')!.heardAs).toBeUndefined();
  });
});
