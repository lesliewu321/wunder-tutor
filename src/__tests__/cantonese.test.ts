import { describe, expect, it } from 'vitest';
import { YUE } from '../content/yue/course';
import { courseFor } from '../content/course';
import { courseLessons } from '../engine/curriculum';
import { AGE_BANDS, lessonExercises } from '../../astra-lessons/curriculum';
import { scenariosFor } from '../content/scenarios';
import { itemCourse } from '../engine/learning';
import { automaticVoices, voiceSupports } from '../speech/teacherPreference';
import { flagCountry } from '../ui/LanguageFlag';
import type { ApiHealth } from '../speech/health';

describe('Hong Kong Cantonese integration', () => {
 it('keeps spoken Traditional Cantonese and aligned Jyutping on every practice item', () => {
  for (const item of Object.values(YUE.items)) {
   expect(itemCourse(item)).toBe('yue'); expect(item.lang).toBe('zh-HK');
   expect(item.yue?.jyutping.split(' ').length, item.text).toBe([...item.text.matchAll(/\p{Script=Han}/gu)].length);
   expect(item.meaning).toBeTruthy();
  }
 });
 it.each(AGE_BANDS)('%s has a connected foundation-to-application path and playable plans', band => {
  const course = courseFor('yue', band), lessons=courseLessons(course);
  expect(lessons).toHaveLength(28); expect(course.units[0].id).toBe('yue-greetings'); expect(course.units[course.units.length - 1].id).toBe('yue-work');
  for(const lesson of lessons) expect(lessonExercises(lesson,band).length).toBeGreaterThanOrEqual(3);
  const texts=lessons.flatMap(l=>lessonExercises(l,band)).filter(e=>e.type==='speak').map(e=>e.item.text);
  expect(texts.includes('我哋聽日開會。')).toBe(band==='adult');
 });
 it('offers a conversation for each course topic and accepts coherent replies to speaking slowly', () => {
  expect(scenariosFor('yue')).toHaveLength(7);
  const turn=scenariosFor('yue').find(s=>s.id==='yue-work')!.turns[1];
  expect(turn.tutor.junior.text).toContain('講慢啲');
  expect(turn.replies.junior[0].text).toBe('好，我講慢啲。');
 });
 it('uses Hong Kong voice routes and its flag instead of Mandarin or an English default', () => {
  const h={gemini:true,voiceProviders:{gemini:true,azure:true,chirp:true,qwen:true}} as ApiHealth;
  expect(automaticVoices(h,'zh-HK')).toEqual(['azure','chirp','qwen']);
  expect(voiceSupports('gemini','zh-HK')).toBe(false);
  expect(flagCountry('yue')).toBe('hk'); expect(flagCountry('zh')).toBe('cn');
  expect(flagCountry('en','en-US')).toBe('us'); expect(flagCountry('en','en-GB')).toBe('gb');
 });
});
