import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseId, SpeakItem } from '../domain/types';
import { frFullyKnown } from '../content/fr/course';
import { FR_SCENARIO_REPLIES } from '../content/fr/scenarios';
import { SCENARIOS, scenariosFor, type Scenario } from '../content/scenarios';
import { hanChars } from '../content/zh/script';
import { ScriptedTutor } from '../tutor/tutor';

const BANDS = ['little', 'junior', 'teen'] as const;
const linesOf = (s: Scenario): SpeakItem[] => [
  ...s.turns.flatMap((t) => BANDS.flatMap((b) => [t.tutor[b], ...t.replies[b]])),
  ...BANDS.map((b) => s.closing[b]),
];
const LANG: Record<CourseId, SpeakItem['lang']> = { en: undefined, zh: 'zh-CN', fr: 'fr-FR', ja: 'ja-JP' };

describe('conversations follow the course being learned', () => {
  it('gives every course its own three scenes', () => {
    for (const course of ['en', 'zh', 'fr', 'ja'] as CourseId[]) expect(scenariosFor(course).map((s) => s.course)).toEqual([course, course, course]);
  });

  it('never repeats a scenario id — a score is kept against it', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes every line in the language of its course (the voice, the scorer and the text all follow it)', () => {
    for (const s of SCENARIOS) for (const line of linesOf(s)) expect(line.lang, `${s.id}: ${line.text}`).toBe(LANG[s.course]);
  });

  it('keeps English lines on the ids they always had, so a learner’s history still matches', () => {
    const cafe = scenariosFor('en').find((s) => s.id === 'cafe')!;
    expect(cafe.turns[0].replies.little[0]).toMatchObject({ id: 'say-yes-please-', text: 'Yes, please.' });
  });

  it('offers one or two things to say at every turn, for every age', () => {
    for (const s of SCENARIOS) {
      for (const t of s.turns) for (const b of BANDS) expect(t.replies[b].length, `${s.id} ${b}`).toBeGreaterThanOrEqual(1);
      for (const t of s.turns) for (const b of BANDS) expect(t.replies[b].length, `${s.id} ${b}`).toBeLessThanOrEqual(2);
    }
  });

  it('shows a Hong Kong reader the same line in Traditional characters, character for character', () => {
    for (const s of scenariosFor('zh')) {
      for (const line of linesOf(s)) {
        expect(line.zh, line.text).toBeTruthy();
        expect(hanChars(line.zh!.hant).length, `${line.text} / ${line.zh!.hant}`).toBe(hanChars(line.text).length);
      }
    }
  });

  it('can name the sounds of every word a learner says in French', () => {
    const unknown = FR_SCENARIO_REPLIES.filter((it) => !frFullyKnown(it)).map((it) => it.text);
    expect(unknown).toEqual([]);
  });

  it('plays each scripted conversation through to its goodbye, at every age', async () => {
    // The script pauses half a second before each line, as a person would; the test does not wait for it.
    vi.useFakeTimers();
    const tutor = new ScriptedTutor();
    for (const s of SCENARIOS) {
      for (const band of ['little', 'junior', 'teen', 'adult'] as const) {
        const history: { role: 'tutor' | 'child'; text: string }[] = [];
        for (let i = 0; i <= s.turns.length; i++) {
          const pending = tutor.next(s, band, history);
          await vi.advanceTimersByTimeAsync(600);
          const r = await pending;
          history.push({ role: 'tutor', text: r.reply.text });
          if (r.done) break;
          history.push({ role: 'child', text: r.suggestions[0].text });
        }
        expect(history.filter((h) => h.role === 'child').length, `${s.id} ${band}`).toBe(s.turns.length);
      }
    }
  });
});

afterEach(() => vi.useRealTimers());
