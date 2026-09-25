import { describe, expect, it } from 'vitest';
import { YUE } from '../content/yue/course';
import { findLesson, courseFor } from '../content/course';
import { courseLessons } from '../engine/curriculum';
import { AGE_BANDS, lessonExercises } from '../../astra-lessons/curriculum';
import { scenariosFor } from '../content/scenarios';
import { buildReview, itemCourse } from '../engine/learning';
import { automaticVoices, voiceSupports } from '../speech/teacherPreference';
import { flagCountry } from '../ui/LanguageFlag';
import { useStore } from '../state/store';
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
  expect(lessons).toHaveLength(96); expect(course.units[0].id).toBe('yue-greetings'); expect(course.units[course.units.length - 1].id).toBe('yue-problems');
  for(const lesson of lessons) expect(lessonExercises(lesson,band).length).toBeGreaterThanOrEqual(3);
  const texts=lessons.flatMap(l=>lessonExercises(l,band)).filter(e=>e.type==='speak').map(e=>e.item.text);
  expect(texts.includes('我哋聽日開會。')).toBe(band==='adult');
 });
 it('offers a conversation for each course topic and accepts coherent replies to speaking slowly', () => {
  expect(scenariosFor('yue')).toHaveLength(24);
  const turn=scenariosFor('yue').find(s=>s.id==='yue-work')!.turns[1];
  expect(turn.tutor.junior.text).toContain('講慢啲');
  expect(turn.replies.junior[0].text).toBe('好，我講慢啲。');
 });
 it('keeps existing lesson identities and covers everyday situations and grammar', () => {
  for (const topic of ['greetings','numbers','food','people','out','shopping','work']) for (let n=1;n<=4;n++) expect(findLesson('yue-'+topic+'-'+n)).toBeTruthy();
  for (const topic of ['family','home','school','animals','weather','feelings','routines','hobbies','dining','services','health','digital','travel','plans','stories','opinions','problems']) expect(courseFor('yue').units.some(u=>u.id==='yue-'+topic)).toBe(true);
  const corpus=YUE.items.map(i=>i.text).join(' ');
  for(const pattern of ['唔','冇','喺','嘅','咗','緊','咩','我哋'])expect(corpus).toContain(pattern);
  expect(YUE.labSounds).toHaveLength(6);
  const used=new Set(Object.values(YUE.course.units).flatMap(u=>u.lessons).flatMap(l=>AGE_BANDS.flatMap(b=>lessonExercises(l,b))).flatMap(e=>e.type==='speak'?[e.item.id]:[]));
  for(const item of YUE.items.filter(i=>/^yue-(family|home|school|animals|weather|feelings|routines|hobbies|dining|health|services|digital|travel|plans|stories|opinions|problems)-/.test(i.id)))expect(used.has(item.id),item.id+' never practised aloud').toBe(true);
 });
 it('never pulls Mandarin history into Cantonese review', () => {
  const id=useStore.getState().createProfile({name:'Course QA',age:25,avatar:'🐯',homeLanguage:'en',accent:'en-US',level:'new',goal:'everyday',learning:['zh','yue']});
  const p={...useStore.getState().profiles[id],course:'yue' as const};
  const mandarin=courseFor('zh').units[0].lessons[0].exercises.junior.find(e=>e.type==='speak');
  if(!mandarin||mandarin.type!=='speak')throw new Error('Missing Mandarin fixture');
  p.items[mandarin.item.id]={itemId:mandarin.item.id,text:mandarin.item.text,best:50,mastered:false,box:0,dueAt:0,attempts:1};
  for(const u of courseFor('yue','adult').units){
   const review=buildReview(u.lessons[3],p,Date.now());
   expect(review.some(e=>e.type==='speak'),u.id+' spoken review').toBe(true);
   for(const e of review)if(e.type==='speak')expect(e.item.lang).toBe('zh-HK');
  }
 });
 it('uses Hong Kong voice routes and its flag instead of Mandarin or an English default', () => {
  const h={gemini:true,voiceProviders:{gemini:true,azure:true,chirp:true,qwen:true}} as ApiHealth;
  expect(automaticVoices(h,'zh-HK')).toEqual(['qwen','chirp']);
  expect(voiceSupports('gemini','zh-HK')).toBe(false);
  expect(flagCountry('yue')).toBe('hk'); expect(flagCountry('zh')).toBe('cn');
  expect(flagCountry('en','en-US')).toBe('us'); expect(flagCountry('en','en-GB')).toBe('gb');
 });
});
