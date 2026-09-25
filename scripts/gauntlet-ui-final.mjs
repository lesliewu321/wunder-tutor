import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/Leslie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:'msedge'}),base=process.env.GAUNTLET_URL||'http://127.0.0.1:5176';
const report={ok:false,screens:[],failuresShown:[],errors:[]};
try{for(const locale of ['en','zh-Hant','zh-Hans','ja','ko','fr','es']){
 const context=await browser.newContext({viewport:{width:320,height:720}}),page=await context.newPage();
 await context.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined});});
 const copy=JSON.parse(fs.readFileSync(`src/i18n/${locale}/common.json`,'utf8'));
 await context.route('**/api/**',r=>new URL(r.request().url()).pathname==='/api/health'?r.fulfill({json:{ok:true,authorized:true,gemini:true,voiceProviders:{azure:true,qwen:true,chirp:true},ttsVersion:'qa-final'}}):r.fulfill({status:502,json:{error:'voice_unavailable'}}));
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>window.__store);
 await page.evaluate(async locale=>{await(await import('/src/i18n/index.ts')).loadLanguage(locale);const s=window.__store.getState();s.createProfile({name:'Gauntlet',age:9,avatar:'🐯',homeLanguage:'en',accent:'en-US',level:'new',goal:'school',learning:['yue']});s.setCourse('yue');s.setSettings({language:locale,demoMic:true,storeRecordings:false,contributeRecordings:false});},locale);
 const nav=async(path,selector)=>{await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'))},path);await page.locator(selector).waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});};
 for(const width of [320,390]){await page.setViewportSize({width,height:844});for(const [path,sel]of Object.entries({'/':'.home','/me':'.me','/parents':'.parents','/progress':'.progress','/lab':'.lab','/twisters':'.lab','/notifications':'.notifications','/book':'.book-screen'})){
  await nav(path,sel);if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))throw Error(locale+path+' overflow '+width);report.screens.push({locale,path,width});
  if(path==='/me'&&width===320)await page.screenshot({path:'.wrangler/gauntlet-final-profile-'+locale+'.png'});
 }}
 await nav('/speak','.practice');await page.locator('.scenario-list li button').first().click();await page.locator('.convo').waitFor();await page.locator('.toast').filter({hasText:copy['common.noSound.line']}).first().waitFor();report.failuresShown.push(locale+'/conversation');
 await nav('/lesson/yue-greetings-1','.lesson-guide');await page.locator('.lesson-guide button').last().click();await page.locator('.lesson').waitFor();await page.locator('.toast').filter({hasText:copy['common.noSound.line']}).first().waitFor();report.failuresShown.push(locale+'/lesson');
 await context.close();console.log(locale+' mobile layouts and teacher failure feedback passed');
}if(report.errors.length)throw Error(report.errors.join('\n'));report.ok=true;}catch(e){report.error=e.stack;throw e}finally{await browser.close();fs.writeFileSync('.wrangler/final-ui-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,screens:report.screens.length,failuresShown:report.failuresShown.length,error:report.error}));}
