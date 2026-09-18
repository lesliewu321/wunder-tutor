import { describe, expect, it } from 'vitest';
import type { Assessment, ChildProfile } from '../domain/types';
import { findLesson, ITEM_INDEX } from '../content/course';
import { wordPhones } from '../content/lexicon';
import { buildReview, isMastered, nextItemProgress } from '../engine/learning';
import { bumpStreak } from '../engine/rewards';
import { applyAssessment, emptyProfile, labOrder, masteredSounds, weakSounds } from '../intelligence/profile';
import { MockPronunciationProvider } from '../speech/mockProvider';
import { simulatedRecording } from '../speech/recorder';
import { SpeechError, type AssessContext, type Recording } from '../speech/types';
import { correctionFor, focusWordIndex } from '../tutor/feedback';

const provider = new MockPronunciationProvider({ latency: false });
const ctx = (over: Partial<AssessContext> = {}): AssessContext => ({
  itemId: 'it-three', accent: 'en-US', band: 'junior', homeLanguage: 'ja', profileId: 'p1', attemptIndex: 0, ...over,
});
const DAY = 86400000;

describe('mock pronunciation provider', () => {
  it('finds the hard sound for the home language and names the substitution', async () => {
    const a = await provider.assess(simulatedRecording(1), 'three', ctx());
    const th = a.words[0].phonemes.find((p) => p.phoneme === 'θ')!;
    expect(th.score).toBeLessThan(65);
    expect(th.heardAs).toBe('s');
    expect(focusWordIndex(a)).toBe(0);
    const c = correctionFor(a.words[0], 'junior');
    expect(c.phoneme).toBe('θ');
    expect(c.problem).toContain('“th”');
    expect(c.tip.toLowerCase()).toContain('tongue');
  });

  it('improves on retry after coaching', async () => {
    const first = await provider.assess(simulatedRecording(1), 'three', ctx());
    const second = await provider.assess(simulatedRecording(1), 'three', ctx({ attemptIndex: 1 }));
    const third = await provider.assess(simulatedRecording(1), 'three', ctx({ attemptIndex: 2 }));
    expect(second.overall).toBeGreaterThan(first.overall);
    expect(third.overall).toBeGreaterThan(second.overall);
  });

  it('reports omissions when the recording is too short for the sentence', async () => {
    const rec: Recording = { simulated: false, analysis: { durationMs: 900, speechMs: 500, peak: 0.5, speechRms: 0.1, noiseRms: 0.004 } };
    const a = await provider.assess(rec, 'I would like a cup of hot chocolate.', ctx({ itemId: 'x' }));
    expect(a.completeness).toBeLessThan(100);
    expect(a.words[a.words.length - 1].errorType).toBe('omission');
    expect(correctionFor(a.words[a.words.length - 1], 'junior').kind).toBe('omission');
  });

  it('rejects silence and noise instead of inventing a score', async () => {
    const silent: Recording = { simulated: false, analysis: { durationMs: 2000, speechMs: 0, peak: 0.004, speechRms: 0, noiseRms: 0.002 } };
    const noisy: Recording = { simulated: false, analysis: { durationMs: 2000, speechMs: 900, peak: 0.6, speechRms: 0.1, noiseRms: 0.06 } };
    await expect(provider.assess(silent, 'three', ctx())).rejects.toMatchObject({ code: 'no-speech' });
    await expect(provider.assess(noisy, 'three', ctx())).rejects.toBeInstanceOf(SpeechError);
  });

  it('does not expect an R-coloured ending from a British-English learner', () => {
    expect(wordPhones('water', 'en-US').syllables[1].phonemes).toContain('ɚ');
    expect(wordPhones('water', 'en-GB').syllables[1].phonemes).toEqual(['t', 'ə']);
    expect(wordPhones('warm', 'en-GB').syllables[0].phonemes).not.toContain('r');
  });
});

describe('pronunciation intelligence', () => {
  const take = (score: number): Assessment => ({
    provider: 't', referenceText: 'three', overall: score, accuracy: score, fluency: 90, completeness: 100, durationMs: 1000,
    words: [{ word: 'three', score, errorType: 'none', syllables: [], phonemes: [{ phoneme: 'θ', score, heardAs: score < 72 ? 's' : undefined }, { phoneme: 'i', score: 95 }] }],
  });

  it('remembers a recurring weakness and its substitution', () => {
    let p = emptyProfile();
    p = applyAssessment(p, take(50), 1000, false).profile;
    expect(weakSounds(p)).toHaveLength(0); // one bad take is not a pattern
    p = applyAssessment(p, take(55), 2000, true).profile;
    expect(weakSounds(p)[0].phoneme).toBe('θ');
    expect(p.phonemes['θ'].heardAs.s).toBe(2);
    expect(labOrder(p, 'es')[0]).toBe('θ');
  });

  it('only calls a sound mastered when it holds up on a second day', () => {
    let p = emptyProfile();
    const t0 = new Date('2026-03-02T10:00:00').getTime();
    for (let i = 0; i < 8; i++) p = applyAssessment(p, take(96), t0 + i * 1000, false).profile;
    expect(masteredSounds(p)).toHaveLength(0);
    const r = applyAssessment(p, take(96), t0 + DAY, false);
    expect(r.events.soundsMastered).toContain('θ');
    expect(masteredSounds(r.profile)[0].phoneme).toBe('θ');
  });
});

describe('learning engine', () => {
  const item = ITEM_INDEX['it-three'];

  it('schedules spaced repetition by how easily the item was mastered', () => {
    const first = nextItemProgress(undefined, item, 92, true, 1, 0);
    const struggled = nextItemProgress(undefined, item, 78, true, 3, 0);
    const failed = nextItemProgress(first, item, 50, false, 3, 0);
    expect(first.box).toBe(2);
    expect(struggled.box).toBe(1);
    expect(first.dueAt).toBeGreaterThan(struggled.dueAt);
    expect(failed.box).toBe(0);
    expect(failed.mastered).toBe(true); // never un-master: difficulty is not punished
  });

  it('uses a gentler mastery bar for younger children', () => {
    const a: Assessment = { provider: 't', referenceText: 'x', overall: 72, accuracy: 72, fluency: 90, completeness: 100, durationMs: 1, words: [{ word: 'x', score: 72, errorType: 'none', syllables: [], phonemes: [] }] };
    expect(isMastered(a, 'little')).toBe(true);
    expect(isMastered(a, 'teen')).toBe(false);
  });

  it('builds a personal review from due items and weak sounds', () => {
    const profile = {
      band: 'junior', items: { 'it-three': { ...nextItemProgress(undefined, item, 60, false, 3, 0), dueAt: 0 } },
      pronunciation: { phonemes: { r: { phoneme: 'r', ema: 50, first: 50, best: 60, count: 3, lowCount: 3, lastSeen: 0, days: 1, heardAs: {} } }, words: {}, days: {} },
    } as unknown as ChildProfile;
    const texts = buildReview(findLesson('food-7')!, profile, 10).map((e) => (e.type === 'speak' ? e.item.text : ''));
    expect(texts).toContain('three');
    expect(texts).toContain('red');
  });

  it('keeps a streak across consecutive days and resets after a gap', () => {
    const d1 = new Date('2026-03-02T09:00:00').getTime();
    let s = bumpStreak({ count: 0, lastDay: null, best: 0 }, d1);
    s = bumpStreak(s, d1 + DAY);
    expect(s.count).toBe(2);
    s = bumpStreak(s, d1 + 4 * DAY);
    expect(s).toMatchObject({ count: 1, best: 2 });
  });
});
