import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CantoneseTones } from '../ui/CantoneseTones';
import { YUE } from '../content/yue/course';
import { courseFor, courseTitle, lessonTitle, unitTitle, unitSubtitle } from '../content/course';
import { scenariosFor, scenarioTitle, scenarioBlurb } from '../content/scenarios';
import { phonemeInfo, soundLocale } from '../content/phonemes';
import { shownText, setDisplayScript } from '../content/zh/script';
import { AGE_BANDS } from '../../astra-lessons/curriculum';
import { contentBand } from '../domain/types';
import { catalogs, itemMeaning, LANGUAGES, loadLanguage, setLanguage, tc, tl } from '../i18n';
import pack from '../../astra-lessons/i18n/cantonese.json';
import { localeOf } from '../speech/voice';

beforeAll(async()=>{await Promise.all(LANGUAGES.map(l=>loadLanguage(l.id)));});
afterAll(()=>{setLanguage('en');setDisplayScript('hant');});

describe('complete Cantonese translation matrix',()=>{
 it.each(LANGUAGES)('$id has every authored title, instruction, meaning and sound guide without fallback',({id})=>{
  setLanguage(id);
  for(const part of ['content','lessons','meanings'] as const){
   expect(Object.keys(pack[id][part]).sort()).toEqual(Object.keys(pack.en[part]).sort());
   for(const key of Object.keys(pack.en[part])){
    const expected=(pack[id][part] as Record<string,string>)[key];
    expect(expected?.trim(),`${id}/${part}/${key}`).toBeTruthy();
    expect(catalogs[part][id]?.[key],`${id}/${part}/${key}`).toBe(expected);
    if(part==='content')expect(tc(key,key)).toBe(expected);
    if(part==='lessons')expect(tl(key,(pack['zh-Hant'].lessons as Record<string,string>)[key])).toBe(expected);
   }
  }
  for(const item of YUE.items)expect(itemMeaning(item),`${id}/${item.id}`).toBe((pack[id].meanings as Record<string,string>)[item.meaning!]);
 });
 const matrix=LANGUAGES.flatMap(({id})=>AGE_BANDS.flatMap(band=>(['hans','hant'] as const).flatMap(script=>(['en-US','en-GB'] as const).map(accent=>({id,band,script,accent})))));
 it.each(matrix)('$id / $band / $script / $accent keeps titles, conversations and pronunciation Cantonese',({id,band,script,accent})=>{
  setLanguage(id);setDisplayScript(script);
  const expected=pack[id].content as Record<string,string>;
  const course=courseFor('yue',band);
  expect(courseTitle(course,band)).toBe(expected['course.hong-kong-cantonese.title']);
  for(const u of course.units){
   expect(unitTitle(u,band)).toBe(expected[`unit.${u.id}.title`]);
   expect(unitSubtitle(u,band)).toBe(expected[`unit.${u.id}.subtitle`]);
   for(const l of u.lessons)expect(lessonTitle(l)).toBe(expected[`lesson.${l.id}.title`]);
  }
  for(const scenario of scenariosFor('yue')){
   expect(scenarioTitle(scenario)).toBe(expected[`scenario.${scenario.id}.title`]);
   expect(scenarioBlurb(scenario,contentBand(band))).toBe(expected[`scenario.${scenario.id}.blurb.${contentBand(band)}`]);
   const items=[scenario.closing[contentBand(band)],...scenario.turns.flatMap(t=>[t.tutor[contentBand(band)],...t.replies[contentBand(band)]])];
   for(const item of items){expect(localeOf(item,accent)).toBe('zh-HK');expect(shownText(item,script)).toBe(item.text);expect(item.yue?.jyutping).toBeTruthy();expect(item.zh).toBeUndefined();expect(itemMeaning(item)).toBe((pack[id].meanings as Record<string,string>)[item.meaning!]);}
  }
  for(const sound of YUE.labSounds){
   const info=phonemeInfo(sound);expect(info.name).toBe(expected[`sound.${sound}.name`]);expect(info.tip.junior).toBe(expected[`sound.${sound}.tip.junior`]);expect(soundLocale(sound,accent)).toBe('zh-HK');
   for(const item of Object.values(YUE.ladders[sound]).flat()){expect(localeOf(item,accent)).toBe('zh-HK');expect(shownText(item,script)).toBe(item.text);expect(itemMeaning(item)).toBeTruthy();}
  }
 });
 it.each(LANGUAGES)('$id renders six Cantonese tones with a translated accessible label',({id})=>{
  setLanguage(id);
  const html=renderToStaticMarkup(<CantoneseTones />);
  expect(html.match(/class="tone__target"/g)).toHaveLength(6);
  for(let n=1;n<=6;n++)expect(html).toContain(`si${n}`);
  expect(html).toContain((pack[id].content as Record<string,string>)['sound.yue:tones.name']);
  expect(html).not.toMatch(/NaN|undefined|dipping low/);
 });
});
