import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AGE_BANDS, lessonExercises } from '../../astra-lessons/curriculum';
import { COURSES, courseFor } from '../content/course';
import { courseLessons, sameSentence } from '../engine/curriculum';
import { catalogs, en, LANGUAGES, loadLanguage, setLanguage, t, tl, itemMeaning, meaningKey, type Key } from '../i18n';
import { shownText } from '../content/zh/script';
import { localeOf } from '../speech/voice';
import type { Exercise, SpeakItem } from '../domain/types';

const own: Record<string, string> = { 'zh-Hant': 'zh-CN', 'zh-Hans': 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', es: 'es-ES' };
const items = (e: Exercise): SpeakItem[] => e.type === 'speak' || e.type === 'arrange' ? [e.item] : e.type === 'read-choice' ? [e.passage, ...e.options] : e.type === 'choose-heard' ? e.options : e.type === 'minimal-pair' ? e.pair : [...(e.tutor ? [e.tutor] : [{ id: e.id, text: e.tutorLine, kind: 'sentence' as const }]), ...e.replies];
beforeAll(async () => { await Promise.all(LANGUAGES.map(l => loadLanguage(l.id))); });
afterAll(() => setLanguage('en'));
describe('gauntlet: runtime translation permutations', () => {
  it.each(LANGUAGES)('$id fills every interface string without placeholders or fallback', ({ id }) => {
    setLanguage(id);
    const failures: string[] = [];
    for (const [key, source] of Object.entries(en)) {
      if (key.endsWith('.one') && !catalogs.interface[id]?.[key]) continue;
      const expected = catalogs.interface[id]?.[key];
      const params = Object.fromEntries([...source.matchAll(/\{(\w+)\}/g)].map(m => [m[1], 'QA']));
      if (!expected || t(key as Key, params) !== expected.replace(/\{(\w+)\}/g, (_, k) => params[k]) || /\{\w+\}/.test(t(key as Key, params))) failures.push(key);
    }
    expect(failures).toEqual([]);
  });
  const matrix = LANGUAGES.flatMap(({ id: locale }) => Object.values(COURSES).flatMap(c => AGE_BANDS.flatMap(band => (['hans', 'hant'] as const).flatMap(script => (['en-US', 'en-GB'] as const).map(accent => ({ locale, course: c.language, band, script, accent }))))));
  it.each(matrix)('$locale / $course / $band / $script / $accent: every lesson, guide, meaning and exercise answer', ({ locale, course, band, script, accent }) => {
    setLanguage(locale); const failures: string[] = [];
    const translated = (english: string, hant: string, id: string) => {
      const expected = locale === 'en' ? english : locale === 'zh-Hant' ? hant : catalogs.lessons[locale]?.[english];
      if (!expected?.trim() || tl(english, hant) !== expected) failures.push(id + ': instruction');
    };
    for (const lesson of courseLessons(courseFor(course, band))) {
      if (lesson.guide) for (const key of ['goal', 'tip', 'practice'] as const) translated(lesson.guide[key], lesson.guide[`${key}Hant`], lesson.id + '/' + key);
      for (const ex of lessonExercises(lesson, band)) {
        if (ex.type === 'read-choice') {
          translated(ex.question, ex.questionHant, ex.id + '/question');
          // Evidence templates deliberately quote the course-language sentence at rendering time.
          if (!/^The evidence is in sentence [12]: /.test(ex.explanation)) translated(ex.explanation, ex.explanationHant, ex.id + '/explanation');
          if (!ex.options.some(o => o.id === ex.answer.id)) failures.push(ex.id + ': answer');
        }
        if (ex.type === 'choose-heard' && !ex.options.some(o => o.id === ex.answer.id)) failures.push(ex.id + ': answer');
        if (ex.type === 'arrange') {
          const chunks = script === 'hant' ? ex.chunksHant ?? ex.chunks : ex.chunks;
          if (!sameSentence(chunks.join(ex.item.zh ? '' : ' '), shownText(ex.item, script))) failures.push(ex.id + ': arrangement');
        }
        for (const item of items(ex)) {
          const key = meaningKey(item), meaning = itemMeaning(item);
          const hidden = !key || item.lang === own[locale] && locale !== 'en' || locale === 'en' && !item.lang && key === item.text;
          const expected = hidden ? null : locale === 'en' ? key : catalogs.meanings[locale]?.[key!];
          if (meaning !== expected || !hidden && !expected) failures.push(item.id + ': meaning');
          if (localeOf(item, accent) !== (item.lang ?? accent)) failures.push(item.id + ': spoken language');
          if (!shownText(item, script)?.trim()) failures.push(item.id + ': script');
          if ((item.say ?? item.text).length > 200) failures.push(item.id + ': voice length');
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
