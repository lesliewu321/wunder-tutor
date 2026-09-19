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

// ---- Real responses captured from a live eastasia Speech resource (synthetic teacher audio as the "learner") ----
import perfectThree from './fixtures/azure-three.json';
import cleanSentence from './fixtures/azure-sentence.json';
import wrongWord from './fixtures/azure-wrongword.json';
import skippedWords from './fixtures/azure-omission.json';
import { isMastered } from '../engine/learning';

describe('Azure — live response fixtures', () => {
  it('scores a perfect single word by its sounds, not by one-word prosody', () => {
    expect(perfectThree.NBest[0].PronScore).toBeLessThan(90); // what Azure reports
    const a = mapAzure(perfectThree, 'three', 0);
    expect(a.overall).toBe(100);
    expect(a.words[0].phonemes.map((p) => p.phoneme)).toEqual(['θ', 'r', 'i']);
    expect(focusWordIndex(a)).toBe(-1);
    expect(isMastered(a, 'teen')).toBe(true);
  });

  it('keeps sentence-level scoring and finds nothing to fix in a clean reading', () => {
    const a = mapAzure(cleanSentence, 'I would like a cup of hot chocolate.', 0);
    expect(a.overall).toBe(96);
    expect(a.words).toHaveLength(8);
    expect(focusWordIndex(a)).toBe(-1); // "chocolate" 94 with an unreleased final t is not a teaching moment
    expect(isMastered(a, 'teen')).toBe(true);
  });

  it('does not let a wrong sound pass just because the word-level score is lenient', () => {
    const a = mapAzure(wrongWord, 'tree', 0); // the audio actually says "three"
    expect(a.words[0].score).toBe(80);
    expect(a.overall).toBe(80); // above the junior bar of 76…
    expect(isMastered(a, 'junior')).toBe(false); // …but the first sound scored 25
    const c = correctionFor(a.words[focusWordIndex(a)], 'junior');
    expect(c.phoneme).toBe('t');
    expect(c.kind).toBe('sound');
  });

  it('surfaces skipped words first and blocks mastery', () => {
    const a = mapAzure(skippedWords, 'I would like a big cup of hot chocolate with milk.', 0);
    expect(a.words.filter((w) => w.errorType === 'omission').map((w) => w.word)).toEqual(['big', 'with', 'milk']);
    expect(a.completeness).toBe(73);
    expect(correctionFor(a.words[focusWordIndex(a)], 'junior').kind).toBe('omission');
    expect(isMastered(a, 'little')).toBe(false);
  });
});

// ---- British English: Azure scores every sound but names none of them (live en-GB responses) ----
import gbSentence from './fixtures/azure-gb-sentence.json';
import gbThirsty from './fixtures/azure-gb-thirsty.json';
import gbThreeSaidFree from './fixtures/azure-gb-three-said-free.json';
import { alignmentCandidates } from '../content/lexicon';
import { applyAssessment, emptyProfile } from '../intelligence/profile';

describe('Azure — British English alignment', () => {
  it('confirms the premise: en-GB phonemes arrive unnamed', () => {
    const raw = gbSentence.NBest[0].Words.flatMap((w) => w.Phonemes.map((p) => p.Phoneme));
    expect(raw.every((name) => !name)).toBe(true);
  });

  it('names them from our own British pronunciations', () => {
    const a = mapAzure(gbSentence, 'Can I have some water, please?', 0, 'en-GB');
    const sounds = Object.fromEntries(a.words.map((w) => [w.word.toLowerCase(), w.phonemes.map((p) => p.phoneme).join(' ')]));
    expect(sounds.can).toBe('k æ n');
    expect(sounds.have).toBe('h æ v');
    expect(sounds.please).toBe('p l i z');
    expect(a.words.flatMap((w) => w.phonemes).every((p) => p.phoneme)).toBe(true);
  });

  it('never coaches a British learner on a silent R', () => {
    // Azure's en-GB model keeps a slot for post-vocalic R: "water" has 5 scores, "thirsty" 6.
    const water = mapAzure(gbSentence, 'Can I have some water, please?', 0, 'en-GB').words.find((w) => w.word.toLowerCase() === 'water')!;
    expect(gbSentence.NBest[0].Words.find((w) => w.Word.toLowerCase() === 'water')!.Phonemes).toHaveLength(5);
    expect(water.phonemes.map((p) => p.phoneme)).toEqual(['w', 'ɔ', 't', 'ə']);

    const thirsty = mapAzure(gbThirsty, 'thirsty', 0, 'en-GB').words[0];
    expect(thirsty.phonemes.map((p) => p.phoneme)).toEqual(['θ', 'ɜ', 's', 't', 'i']);
    expect(alignmentCandidates('turn', 'en-GB').map((c) => c.phonemes.join(' '))).toEqual(['t ɜ n', 't ɜ r n']);
    expect(alignmentCandidates('turn', 'en-US')).toHaveLength(1);
  });

  it('catches the classic Hong Kong "free" for "three" and says so honestly', () => {
    const a = mapAzure(gbThreeSaidFree, 'three', 0, 'en-GB');
    expect(a.words[0].phonemes[0].phoneme).toBe('θ');
    expect(a.words[0].phonemes[0].score).toBeLessThan(a.words[0].phonemes[1].score); // the first sound is the weak one
    expect(isMastered(a, 'junior')).toBe(false);

    const c = correctionFor(a.words[0], 'junior', 'yue');
    expect(c).toMatchObject({ kind: 'sound', phoneme: 'θ' });
    expect(c.problem).toBe('Your “th” wasn’t clear. Careful — it easily turns into “f”.'); // likelihood, not a claim about what was heard
    expect(c.tip).toMatch(/between your teeth/);
    // A Mandarin-speaking child gets the Mandarin pattern instead.
    expect(correctionFor(a.words[0], 'junior', 'zh').problem).toContain('“s”');
  });

  it('gives honest word-level advice when a sound cannot be named, and remembers nothing false', () => {
    const unknown = mapAzure({ RecognitionStatus: 'Success', NBest: [{ AccuracyScore: 55, PronScore: 55, Words: [{ Word: 'zebra', AccuracyScore: 55, ErrorType: 'None', Phonemes: [{ AccuracyScore: 40 }, { AccuracyScore: 90 }] }] }] }, 'zebra', 0, 'en-GB');
    expect(unknown.words[0].phonemes.map((p) => p.phoneme)).toEqual(['', '']);
    const c = correctionFor(unknown.words[0], 'junior', 'yue');
    expect(c.kind).toBe('word');
    expect(c.phoneme).toBeUndefined();
    expect(Object.keys(applyAssessment(emptyProfile(), unknown, 0, false).profile.phonemes)).toEqual([]);
  });
});
