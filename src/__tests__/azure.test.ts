import { describe, expect, it } from 'vitest';
import { mapAzure } from '../speech/azureProvider';
import { correctionFor, focusWordIndex } from '../tutor/feedback';

// Shape of Azure's short-audio REST response with Pronunciation Assessment (format=detailed):
// scores sit flat on NBest[0]; Duration/Offset are in 100 ns ticks.
const SAMPLE = {
  RecognitionStatus: 'Success', Offset: 1200000, Duration: 21500000, DisplayText: 'I would like three.',
  NBest: [{
    Confidence: 0.93, Lexical: 'i would like three', Display: 'I would like three.',
    AccuracyScore: 81, FluencyScore: 90, CompletenessScore: 80, PronScore: 79.4, ProsodyScore: 84.2,
    Words: [
      { Word: 'i', AccuracyScore: 98, ErrorType: 'None', Phonemes: [{ Phoneme: 'aɪ', AccuracyScore: 98 }] },
      { Word: 'would', AccuracyScore: 91, ErrorType: 'None', Syllables: [{ Syllable: 'wʊd', Grapheme: 'would', AccuracyScore: 91 }], Phonemes: [{ Phoneme: 'w', AccuracyScore: 95 }, { Phoneme: 'ʊ', AccuracyScore: 84 }, { Phoneme: 'd', AccuracyScore: 94 }] },
      { Word: 'like', AccuracyScore: 0, ErrorType: 'Omission', Phonemes: [] },
      { Word: 'three', AccuracyScore: 52, ErrorType: 'Mispronunciation', Phonemes: [{ Phoneme: 'θ', AccuracyScore: 31 }, { Phoneme: 'ɹ', AccuracyScore: 58 }, { Phoneme: 'iː', AccuracyScore: 96 }] },
    ],
  }],
};

describe('Azure pronunciation adapter', () => {
  it('maps the documented response into the provider-neutral assessment', () => {
    const a = mapAzure(SAMPLE, 'I would like three.', 0);
    expect(a).toMatchObject({ provider: 'azure', overall: 79, accuracy: 81, fluency: 90, completeness: 80, prosody: 84, durationMs: 2150 });
    expect(a.words.map((w) => w.errorType)).toEqual(['none', 'none', 'omission', 'mispronunciation']);
    // Azure's IPA is normalised onto our catalogue: ɹ → r, iː → i.
    expect(a.words[3].phonemes.map((p) => p.phoneme)).toEqual(['θ', 'r', 'i']);
    expect(a.words[1].syllables[0]).toEqual({ text: 'would', score: 91 });
  });

  it('feeds the same teaching pipeline as the built-in model', () => {
    const a = mapAzure(SAMPLE, 'I would like three.', 0);
    expect(focusWordIndex(a)).toBe(2); // the skipped word is the first thing to fix
    expect(correctionFor(a.words[2], 'junior').kind).toBe('omission');
    const th = correctionFor(a.words[3], 'junior');
    expect(th.phoneme).toBe('θ');
    expect(th.tip).toMatch(/tongue/i);
  });

  it('turns silence into a no-speech error rather than a zero score', () => {
    expect(() => mapAzure({ RecognitionStatus: 'InitialSilenceTimeout' }, 'three', 0)).toThrowError(expect.objectContaining({ code: 'no-speech' }));
    expect(() => mapAzure({ RecognitionStatus: 'Success', NBest: [] }, 'three', 0)).toThrowError(expect.objectContaining({ code: 'no-speech' }));
  });
});
