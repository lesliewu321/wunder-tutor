import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/Leslie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),base=process.env.GAUNTLET_URL||'http://127.0.0.1:5176';
const report={ok:false,lessons:[],notebooks:[],conversations:[],errors:[],screens:[]};
const assert=(v,m)=>{if(!v)throw Error(m)};
try{
for(const locale of ['en','zh-Hant','zh-Hans','ja','ko','fr','es']){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
 const copy=Object.assign({},...['common','home','lesson','practice','speak'].map(f=>JSON.parse(fs.readFileSync(`src/i18n/${locale}/${f}.json`,'utf8'))));
 page.on('pageerror',e=>report.errors.push(locale+': '+e.message));
 await context.route('**/api/**',r=>new URL(r.request().url()).pathname==='/api/health'?r.fulfill({json:{ok:true,authorized:true,azure:true,read:true,voiceProviders:{azure:true},ttsVersion:'qa-flow'}}):r.fulfill({json:{}}));
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 await page.goto(base);await page.waitForFunction(()=>window.__store);
 await page.evaluate(async locale=>{
  const {loadLanguage}=await import('/src/i18n/index.ts');await loadLanguage(locale);
  const s=window.__store.getState();s.createProfile({name:'Gauntlet',age:9,avatar:'🐯',homeLanguage:'en',accent:'en-US',level:'new',goal:'school',learning:['en','zh','yue','ja','ko','fr','es']});s.setSettings({language:locale,demoMic:true,simulate:'none',contributeRecordings:false,storeRecordings:false});
  const {voice}=await import('/src/speech/voice.ts');voice.speak=async()=>{};voice.prefetch=()=>{};
 },locale);
 const nav=async path=>{await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'))},path);};
 for(const course of ['en','zh','yue','ja','ko','fr','es']){
  const chosen=await page.evaluate(async course=>{const s=window.__store.getState();s.setCourse(course);const {lessonsOf}=await import('/src/content/course.ts');const ls=lessonsOf(course,'junior');const l=[...ls].sort((a,b)=>new Set(b.exercises.junior.map(e=>e.type)).size-new Set(a.exercises.junior.map(e=>e.type)).size||a.exercises.junior.length-b.exercises.junior.length)[0];return {id:l.id,types:[...new Set(l.exercises.junior.map(e=>e.type))]};},course);
  await nav('/lesson/'+chosen.id+'?mode=test');await page.locator('.lesson,.complete').waitFor();
  let steps=0;const types=new Set(),deadline=Date.now()+90000;
  while(!await page.locator('.complete').count()){
   assert(++steps<140&&Date.now()<deadline,locale+'/'+course+' stuck: '+(await page.locator('body').innerText()).slice(-2000));
   if(await page.locator('.mic--ready').count()){types.add('speak');await page.locator('.mic--ready').click();await page.locator('.mic--listening').click();await page.locator('.speak__actions .btn--block').first().waitFor();await page.locator('.speak__actions .btn--block').first().click();}
   else if(await page.locator('.dialogue__replies .reply').count()){types.add('dialogue');await page.locator('.dialogue__replies .reply').first().click();}
   else if(await page.locator('.literacy__options .reply').count()){types.add('read-choice');await page.locator('.literacy__options .reply').first().click();}
   else if(await page.locator('.literacy__chunks button').count()){types.add('arrange');for(const button of await page.locator('.literacy__chunks button').all())await button.click();await page.locator('.choice__dock button').click();}
   else if(await page.locator('.options .option').count()){types.add('listening');await page.locator('.options .option').first().click();await page.locator('.choice__dock .btn--block').click();}
   else {if(steps===1)console.log('Waiting '+locale+'/'+course+' '+(await page.locator('body').innerText()).slice(-700));await page.waitForTimeout(100);}
  }
  const saved=await page.evaluate(id=>{const s=window.__store.getState();const p=s.profiles[s.activeId];return p.tests?.[id]||p.lessonTests?.[id]},chosen.id);
  // Completion plus persisted test state is checked separately from the simulated pronunciation scores.
  assert(saved,locale+'/'+course+' test not saved');
  report.lessons.push({locale,course,id:chosen.id,steps,types:[...types],saved:!!saved});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),locale+'/'+course+' completion overflow');
  await nav('/speak');await page.locator('.scenario-list li').first().waitFor();await page.locator('.scenario-list li button').first().click();await page.locator('.bubble').first().waitFor();
  if(locale!=='en'&&(course==='en'||course==='yue'))await page.locator('.bubble__meaning').first().waitFor();
  report.conversations.push(locale+'/'+course);
  for(const route of ['/','/me','/progress','/lab','/twisters','/notifications','/book']){await nav(route);await page.locator('.screen').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),locale+'/'+course+route+' overflow');report.screens.push(locale+'/'+course+route)}
 }
 await nav('/book');await page.locator('.book__type').first().click();await page.locator('#say-text').fill('Hello world. I like apples.');await page.getByRole('button',{name:copy['home.book.typeSheet.go'],exact:true}).click();await page.locator('.say__lines li').first().waitFor();assert(await page.locator('.say__lines li').count()===2,'Notebook line count');
 await page.locator('.book__delete').click();await page.getByRole('dialog').getByRole('button',{name:copy['home.book.delete.cta'],exact:true}).click();await page.locator('.book__start').waitFor();report.notebooks.push(locale);
 await page.setViewportSize({width:320,height:720});await nav('/me');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),locale+' 320px profile overflow');
 await page.screenshot({path:'.wrangler/gauntlet-profile-'+locale+'.png'});
 assert(!report.errors.length,report.errors.join('\n'));await context.close();console.log(locale+' completed: lessons, conversations, seven main screens, Notebook save/delete');
}
report.ok=true;
}catch(e){report.error=e.stack;throw e}finally{fs.writeFileSync('.wrangler/flows-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,lessons:report.lessons.length,error:report.error}));await browser.close()}
