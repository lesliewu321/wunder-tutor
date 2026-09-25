// Run against a separate Vite dev server: node scripts/gauntlet-browser.mjs.
// Optional PLAYWRIGHT_PACKAGE is an absolute package.json path for a bundled Playwright installation.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const base = process.env.GAUNTLET_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ headless: true, channel: process.env.GAUNTLET_BROWSER || 'msedge' });
const context = await browser.newContext({ viewport: {width:390,height:844} });
const page = await context.newPage(), errors=[], calls=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>{
 const path=new URL(r.request().url()).pathname;
 if(path==='/api/health')return r.fulfill({json:{ok:true,authorized:true,azure:true,gemini:true,voiceProviders:{azure:true,gemini:true,qwen:true,chirp:true},voiceVersions:{azure:'qa',qwen:'qa',chirp:'qa'},ttsVersion:'qa'}});
 if(path==='/api/tts'){calls.push(r.request().postDataJSON());return r.fulfill({status:502,json:{error:'provider_unavailable'}});}
 if(path==='/api/notifications')return r.fulfill({json:{enabled:false,thisDevice:false,nextAt:null,prefs:null}});
 return r.fulfill({json:{}});
});
// Keep layout QA independent of an unavailable external font CDN.
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const navigate=async path=>{await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},path);await page.waitForTimeout(35);};
const check=async label=>{
 assert((await page.locator('main,.screen').first().innerText()).length>10,'empty '+label);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+label);
 assert(!errors.length,errors.join('\n'));
};
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__store);
 await page.evaluate(()=>{
  window.__store.getState().createProfile({name:'QA',age:9,avatar:'🐯',homeLanguage:'en',accent:'en-US',level:'new',goal:'everyday',learning:['en','zh','yue','ja','ko','fr','es']});
  window.__store.getState().setSettings({language:'en',demoMic:true,contributeRecordings:false,shareScores:false});
 });
 let rows=0;
 for(const locale of ['en','zh-Hant','zh-Hans','ja','ko','fr','es']){
  await page.evaluate(async locale=>{await (await import('/src/i18n/index.ts')).loadLanguage(locale);window.__store.getState().setSettings({language:locale});},locale);
  for(const band of ['little','junior','teen','adult'])for(const course of ['en','zh','yue','ja','ko','fr','es']){
   await page.evaluate(({band,course})=>{const s=window.__store.getState();s.patchProfile(s.activeId,{band,course});}, {band,course});
   await navigate('/'); await page.locator('.hero__unit .language-flag').waitFor(); await check(locale+'/'+band+'/'+course);rows++;
  }
  await page.evaluate(()=>window.__store.getState().setCourse('yue'));
  // UI flows including empty bonus and Scan states must stay translated for every app language.
  for(const path of ['/parents','/notifications','/speak','/lab','/twisters','/book','/lesson/yue-greetings-1']){
   await navigate(path);await check(locale+path);
   if(path==='/parents')assert(await page.locator('#teacher-voice select option').count()===6,'voice choices '+locale);
   if(path==='/speak')assert(await page.locator('.scenario-list li').count()===7,'Cantonese scenes '+locale);
  }
 }
 await navigate('/me');
 assert(await page.locator('.me .course-pick option').count()===7,'all seven courses must be listed directly');
 assert(!await page.locator('.me .course-pick select').evaluate(e=>e.multiple),'course picker must select only one');
 for(const course of ['en','zh','yue','ja','ko','fr','es']){await page.locator('.me .course-pick select').selectOption(course);assert(await page.evaluate(()=>window.__store.getState().profiles[window.__store.getState().activeId].course)===course,'course switch '+course);}
 await page.evaluate(async()=>{const i=await import('/src/i18n/index.ts');await i.loadLanguage('en');const s=window.__store.getState();s.setSettings({language:'en'});s.patchProfile(s.activeId,{band:'adult',course:'yue'});});
 await navigate('/parents');
 const select=page.locator('#teacher-voice select');
 assert(await select.locator('option[value=gemini]').evaluate(e=>e.disabled),'Gemini must be disabled for Cantonese: '+await page.evaluate(()=>JSON.stringify({profile:window.__store.getState().profiles[window.__store.getState().activeId].course,options:document.querySelector('#teacher-voice select')?.outerHTML})));
 for(const provider of ['azure','qwen','chirp','device','auto']){await select.selectOption(provider);assert(await select.inputValue()===provider,'choice not shown');}
 await select.selectOption('qwen');
 await page.reload({waitUntil:'domcontentloaded'});await select.waitFor();assert(await select.inputValue()==='qwen','choice did not persist');
 await page.locator('#teacher-voice').scrollIntoViewIfNeeded();
 fs.mkdirSync('.wrangler',{recursive:true});
 await page.screenshot({path:'.wrangler/gauntlet-teacher-voice.png'});
 await page.getByRole('button',{name:'Preview voice',exact:true}).click();
 await page.waitForFunction(()=>{const b=Array.from(document.querySelectorAll('#teacher-voice button'))[0];return b&&!b.disabled;});
 assert(calls.some(c=>c.provider==='qwen'&&c.accent==='zh-HK'),'Qwen preview wrong locale');
 await navigate('/');await page.screenshot({path:'.wrangler/gauntlet-cantonese-home.png'});
 await navigate('/lesson/yue-greetings-1');
 const start=page.locator('.lesson-guide button').last();
 if(await start.count())await start.click();
 console.log(JSON.stringify({homePermutations:rows,localizedFlows:49,voiceChoices:6,persistence:true,hkRouting:true,pageErrors:errors}));
}finally{await browser.close();}
