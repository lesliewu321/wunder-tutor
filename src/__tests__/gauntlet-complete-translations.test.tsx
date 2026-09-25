import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AGE_BANDS } from '../../astra-lessons/curriculum';
import { SCENARIOS, scenarioTitle, scenarioBlurb } from '../content/scenarios';
import { PHONEMES, phonemeInfo } from '../content/phonemes';
import { LADDERS } from '../content/lab';
import { SEASONAL_LESSONS } from '../content/seasonal';
import { contentBand, type SpeakItem } from '../domain/types';
import { catalogs, itemMeaning, meaningKey, LANGUAGES, loadLanguage, setLanguage, tl } from '../i18n';
import { setDisplayScript } from '../content/zh/script';
import { LineText } from '../features/practice/Practice';
import cantonese from '../../astra-lessons/i18n/cantonese.json';

beforeAll(async()=>{await Promise.all(LANGUAGES.map(l=>loadLanguage(l.id)))});
afterAll(()=>{setLanguage('en');setDisplayScript('hant')});
const own:Record<string,string>={'zh-Hant':'zh-CN','zh-Hans':'zh-CN',ja:'ja-JP',ko:'ko-KR',fr:'fr-FR',es:'es-ES'};
describe('gauntlet: conversations, sound guides, seasonal lessons and rendered meanings',()=>{
 it.each(LANGUAGES)('$id covers every conversation in every age band, including English and young learners',({id})=>{
  setLanguage(id);const failures:string[]=[];
  for(const scenario of SCENARIOS)for(const band of AGE_BANDS){
   const b=contentBand(band),cat=catalogs.content[id];
   if(id!=='en'){
    if(scenarioTitle(scenario)!==cat?.[`scenario.${scenario.id}.title`])failures.push(scenario.id+': title');
    if(scenarioBlurb(scenario,b)!==cat?.[`scenario.${scenario.id}.blurb.${b}`])failures.push(scenario.id+': blurb');
   }
   const lines=[scenario.closing[b],...scenario.turns.flatMap(t=>[t.tutor[b],...t.replies[b]])];
   for(const item of lines){
    const key=meaningKey(item),hidden=own[id]===item.lang&&id!=='en'||id==='en'&&!item.lang&&!item.meaning;
    const expected=hidden?null:id==='en'?key:catalogs.meanings[id]?.[key!];
    if(itemMeaning(item)!==expected||!hidden&&!expected)failures.push(`${scenario.id}/${item.id}: meaning`);
    const html=renderToStaticMarkup(<LineText it={item} band={band} script="hans"/>);
    if(Boolean(expected)!==html.includes('bubble__meaning'))failures.push(`${scenario.id}/${band}/${item.id}: rendered meaning`);
   }
  }
  expect(failures).toEqual([]);
 });
 it.each(LANGUAGES)('$id sound guide prose never changes with Mandarin practice script',({id})=>{
  if(id==='en')return;setLanguage(id);
  for(const sound of Object.keys(PHONEMES)){
   setDisplayScript('hans');const a=phonemeInfo(sound);
   setDisplayScript('hant');const b=phonemeInfo(sound);
   expect({name:b.name,tip:b.tip,steps:b.steps,problem:b.problem,detail:b.detail},`${id}/${sound}`).toEqual({name:a.name,tip:a.tip,steps:a.steps,problem:a.problem,detail:a.detail});
  }
 });
 it.each(LANGUAGES)('$id includes seasonal guides and every lab ladder meaning',({id})=>{
  setLanguage(id);const failures:string[]=[];
  for(const l of SEASONAL_LESSONS){
   if(l.guide)for(const field of ['goal','tip','practice']as const){const source=l.guide[field],hant=l.guide[`${field}Hant`];const expected=id==='en'?source:id==='zh-Hant'?hant:catalogs.lessons[id]?.[source];if(!expected||tl(source,hant)!==expected)failures.push(l.id+': '+field);}
  }
  for(const ladder of Object.values(LADDERS))for(const item of Object.values(ladder).flat() as SpeakItem[]){
   const key=meaningKey(item);if(!key||own[id]===item.lang||id==='en')continue;
   if(!catalogs.meanings[id]?.[key])failures.push(item.id+': meaning '+key);
  }
  expect(failures).toEqual([]);
 });
 it('Simplified interface keeps the Cantonese grammar examples exactly as taught',()=>{
  for(const [key,source]of Object.entries(cantonese['zh-Hant'].lessons)){
   const translated=(cantonese['zh-Hans'].lessons as Record<string,string>)[key];
   for(const match of source.matchAll(/「([^」]*)」/gu))expect(translated,key).toContain(match[0]);
  }
 });
});
