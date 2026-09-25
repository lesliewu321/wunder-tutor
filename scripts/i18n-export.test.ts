// The checking list for the translation: every line of wording, English next to 繁體中文.
//   npm run i18n:export     → i18n-review.json (and .csv) in the repo root
// Run through vitest (plain `vite-node` hangs on this machine); it does nothing during a normal `npm test`.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COURSES, courseTitle, ITEM_INDEX, lessonTitle, unitSubtitle, unitTitle } from '../src/content/course';
import { LAB_STAGES, stageLabel } from '../src/content/lab';
import { PHONEMES, phonemeInfo, soundLabel, tipFor } from '../src/content/phonemes';
import { SCENARIOS, scenarioBlurb, scenarioTitle } from '../src/content/scenarios';
import { HOME_LANGUAGES, homeLanguageLabel } from '../src/content/translations';
import { SEASON_EVENTS, SEASONAL_LESSONS } from '../src/content/seasonal';
import { ZH_SOUNDS } from '../src/content/zh/sounds';
import { ACHIEVEMENT_CATALOGUE, achievement, badgeDetail, badgeName, DAILY_GOALS, goalDetail, goalLabel } from '../src/engine/rewards';
import { catalogs, en, noteContent, setLanguage, tc } from '../src/i18n';
import type { AgeBand, SpeakItem } from '../src/domain/types';

const BANDS: AgeBand[] = ['little', 'junior', 'teen', 'adult'];
/** The lesson guides and reading questions of every course: English → 繁體中文, one entry per distinct English line. */
const lessonPhrases = (): Record<string, string> => {
  const out: Record<string, string> = {};
  const pairs = [['goal', 'goalHant'], ['tip', 'tipHant'], ['practice', 'practiceHant'], ['question', 'questionHant'], ['explanation', 'explanationHant']] as const;
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>;
    for (const [a, b] of pairs) if (typeof r[a] === 'string' && typeof r[b] === 'string') out[r[a] as string] = r[b] as string;
    Object.values(r).forEach(walk);
  };
  walk(Object.values(COURSES));
  return out;
};
/**
 * What a practice word or sentence means, shown under it (Leslie, 2026-09-25: "this should be translated to app
 * language for all courses"): English meaning → where it is used, for the translator (the item and its language).
 */
const itemMeanings = (): Record<string, { items: string[]; langs: string[] }> => {
  const out: Record<string, { items: string[]; langs: string[] }> = {};
  // The lessons' items, and the conversations' lines (their own files, not in the item index).
  const lines: SpeakItem[] = [];
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>;
    if (typeof r.text === 'string' && typeof r.id === 'string' && typeof r.kind === 'string') { lines.push(r as unknown as SpeakItem); return; }
    Object.values(r).forEach(walk);
  };
  walk(SCENARIOS.map((sc) => [sc.turns, sc.closing]));
  for (const it of [...Object.values(ITEM_INDEX), ...lines]) {
    if (!it.meaning) continue;
    const m = (out[it.meaning] ??= { items: [], langs: [] });
    if (m.items.length < 3 && !m.items.includes(it.text)) m.items.push(it.text);
    const lang = it.lang ?? 'en';
    if (!m.langs.includes(lang)) m.langs.push(lang);
  }
  return out;
};
const quiet = (read: () => unknown) => { try { read(); } catch { /* an id this accessor doesn't know */ } };

/** Where a line shows up, in the order a family meets the app. */
const AREAS: [prefix: string, area: string][] = [
  ['onboarding.', '1 · Setting up (first screens, consent)'], ['settings.', '2 · Settings & Parent Zone'], ['homeLanguage.', '2 · Settings & Parent Zone'],
  ['feedback.', '3 · Pronunciation feedback'], ['speak.', '4 · Speaking screen'], ['sound.', '5 · Sounds: names and tips'],
  ['home.', '6 · Home, My book, camera'], ['lesson.', '7 · Lessons'], ['course.', '7 · Lessons'], ['unit.', '7 · Lessons'],
  ['lab.', '8 · Pronunciation Lab'], ['practice.', '9 · Conversations'], ['scenario.', '9 · Conversations'],
  ['progress.', '10 · Progress and badges'], ['badge.', '10 · Progress and badges'], ['goal.', '10 · Progress and badges'], ['common.', '11 · Shared buttons and labels'],
];
const areaOf = (key: string): string => AREAS.find(([p]) => key.startsWith(p))?.[1] ?? '12 · Other';

// Only through `npm run i18n:export` (scripts/i18n-export.mjs sets the flag), never as part of the normal test run.
describe.skipIf(!process.env.I18N_EXPORT)('i18n review export', () => {
  it('writes every line, English next to Chinese', () => {
    setLanguage('en');
    const seen = noteContent(true)!;
    for (const id of [...Object.keys(PHONEMES), ...ZH_SOUNDS.map((s) => s.id), '∅', 'ɾ', 'ʁ', 'x', 'no-such-sound']) {
      quiet(() => phonemeInfo(id));
      quiet(() => soundLabel(id));
      for (const b of BANDS) quiet(() => tipFor(id, b));
    }
    for (const st of LAB_STAGES) quiet(() => stageLabel(st));
    for (const course of Object.values(COURSES)) {
      for (const b of BANDS) quiet(() => courseTitle(course, b));
      for (const unit of course.units) {
        for (const b of BANDS) { quiet(() => unitTitle(unit, b)); quiet(() => unitSubtitle(unit, b)); }
        for (const lesson of unit.lessons) quiet(() => lessonTitle(lesson));
      }
    }
    for (const entry of Object.values(ACHIEVEMENT_CATALOGUE) as { id?: string }[]) { if (!entry?.id) continue; const a = achievement(entry.id, 0); quiet(() => badgeName(a)); quiet(() => badgeDetail(a)); }
    quiet(() => { const a = achievement('sound-θ', 0); badgeName(a); badgeDetail(a); });
    for (const g of DAILY_GOALS) { quiet(() => goalLabel(g)); quiet(() => goalDetail(g)); }
    for (const s of SCENARIOS) { quiet(() => scenarioTitle(s)); for (const b of BANDS) quiet(() => scenarioBlurb(s, b)); }
    for (const l of HOME_LANGUAGES) quiet(() => homeLanguageLabel(l.id));
    // Festival bonus lessons: the Home card and the lesson title.
    for (const e of SEASON_EVENTS) { quiet(() => tc(`season.${e.id}.title`, e.title)); quiet(() => tc(`season.${e.id}.blurb`, e.blurb)); }
    for (const l of SEASONAL_LESSONS) quiet(() => lessonTitle(l));
    noteContent(false);
    // The sound badges share one line each, filled with the sound: the template, not the example it was noted with.
    seen.set('badge.sound.name', 'Sound mastered: {name}');
    seen.set('badge.sound.detail', 'Your “{label}” is now clear and steady.');

    const zhInterface = catalogs.interface['zh-Hant'], zhContent = catalogs.content['zh-Hant'];
    // In the catalogs' own order: they were written screen by screen, top to bottom, which is how a reader meets the lines.
    const order = new Map([...Object.keys(en), ...Object.keys(zhContent)].map((key, i) => [key, i]));
    const rows = [
      ...Object.entries(en).map(([key, english]) => ({ key, area: areaOf(key), en: english, zh: zhInterface[key] ?? '' })),
      ...Object.entries(zhContent).map(([key, zh]) => ({ key, area: areaOf(key), en: seen.get(key) ?? '', zh: zh ?? '' })),
    ].filter((r) => !(r.key.endsWith('.one') && !r.zh)) // English-only singular forms: nothing to check
      .sort((a, b) => parseInt(a.area, 10) - parseInt(b.area, 10) || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

    writeFileSync('i18n-review.json', JSON.stringify(rows, null, 1));
    // The source for a new App language: every line in English, the interface (with its one/other forms), the wording
    // that lives with data, and the lesson guides and reading questions (keyed by their English, see `tl` in src/i18n).
    writeFileSync('i18n-source.json', JSON.stringify({ interface: en, content: Object.fromEntries([...seen, ...Object.keys(zhContent).filter((k) => !seen.has(k)).map((k) => [k, ''])].sort(([x], [y]) => (order.get(x) ?? 1e9) - (order.get(y) ?? 1e9))), lessons: lessonPhrases(), meanings: itemMeanings() }, null, 1));
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    writeFileSync('i18n-review.csv', `﻿${['key', 'where', 'English', '繁體中文', 'correction', 'comment'].map(cell).join(',')}\r\n${rows.map((r) => [r.key, r.area, r.en, r.zh, '', ''].map(cell).join(',')).join('\r\n')}\r\n`);
    const noEnglish = rows.filter((r) => !r.en).map((r) => r.key);
    console.log(`${rows.length} lines written; without an English source: ${noEnglish.length}${noEnglish.length ? ` (${noEnglish.slice(0, 8).join(', ')}…)` : ''}`);
    expect(rows.length).toBeGreaterThan(1000);
  });
});
