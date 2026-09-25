import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/Leslie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const base=process.env.GAUNTLET_URL||'http://127.0.0.1:5176';
const locales=['en','zh-Hant','zh-Hans','ja','ko','fr','es'],courses=['en','zh','yue','ja','ko','fr','es'];
const report={ok:false,onboarding:[],errors:[]};
const assert=(a,m)=>{if(!a)throw Error(m)};
try{
for(const locale of locales)for(const course of courses)for(const band of ['little','junior','teen','adult']){
 const label=[locale,course,band].join('/'),copy=Object.assign({},...['onboarding','settings','common'].map(f=>JSON.parse(fs.readFileSync(`src/i18n/${locale}/${f}.json`,'utf8'))));
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-HK',timezoneId:'Asia/Hong_Kong',serviceWorkers:'block'});
 let accepted=false;
 await context.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{await new Promise(r=>setTimeout(r,150));throw new DOMException('QA denial','NotAllowedError')}});
 });
 const user={id:'10000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'gauntlet@example.invalid',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 await context.route('https://*.supabase.co/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/otp'))return r.fulfill({json:{}});
  if(path.endsWith('/verify'))return r.request().postDataJSON().token==='12345678'?r.fulfill({json:{access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}}):r.fulfill({status:403,json:{code:'otp_expired',msg:'Invalid fixture code'}});
  if(path.endsWith('/user'))return r.fulfill({json:user});
  return r.fulfill({json:[]});
 });
 await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
  if(path==='/api/health')return r.fulfill({json:{ok:true,needsCode:true,codeSet:true,authorized:accepted,codeAccepted:accepted,azure:accepted,gemini:false,claude:false,read:accepted,voiceProviders:{azure:accepted,qwen:false,chirp:false,gemini:false},ttsVersion:'qa-onboarding'}});
  if(path==='/api/redeem'){accepted=r.request().postDataJSON().code==='qa-fixture';return r.fulfill({json:{ok:accepted,reason:accepted?'master':'unknown'}});}
  return r.fulfill({status:503,json:{error:'qa_fixture'}});
 });
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(label+': '+e.message));
 const fit=async step=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow '+step);assert(!(await page.locator('.onboard__body').innerText()).match(/\{(?:name|settings|tab|n)\}/),label+' unfilled text '+step)};
 const next=async()=>{await page.locator('.onboard__dock button').first().click();};
 await page.goto(base+'/welcome',{waitUntil:'domcontentloaded'});
 await page.locator('.lang-pick select').selectOption(locale);await page.getByRole('button',{name:copy['onboarding.welcome.start'],exact:true}).waitFor();
 await fit('welcome');await next();
 await page.locator('.chips button').nth(courses.indexOf(course)).click();
 assert(await page.locator('.onboard__dock button').first().isDisabled(),label+' language gate');
 await page.locator('.grid-2 button').nth(1).click();await fit('languages');await next();
 assert(await page.locator('.onboard__dock button').first().isDisabled(),label+' age gate');
 await page.locator('.stack .tile').nth(['little','junior','teen','adult'].indexOf(band)).click();await page.locator('#nick').fill('QA');await fit('learner');await next();
 await page.locator('.stack .tile').first().click();await page.locator('.chips button').first().click();await fit('level');await next();
 await page.locator('.stack .tile').first().click();await fit('time');await next();
 if(course==='en'||course==='zh'){await page.locator('.stack .tile').first().waitFor();await fit('course');await next();}
 await page.locator('.privacy').waitFor();assert(await page.locator('.onboard__dock button').first().isDisabled(),label+' consent gate');
 const checks=page.locator('input[type=checkbox]');for (let i=0;i<3;i++) if(await checks.nth(i).isChecked() !== (i===0)) await page.locator('label.switch-row').nth(i).click();await fit('consent');
 // Two activations before the simulated permission denial returns must create only one learner.
 if(report.onboarding.length===0)await page.locator('.onboard__dock button').first().evaluate(b=>{b.click();b.click();});else await next();
 await page.getByRole('heading',{name:copy[band==='adult'?'onboarding.account.title.adult':'onboarding.account.title.child'],exact:true}).waitFor();
 const count=await page.evaluate(()=>Object.keys(window.__store.getState().profiles).length);assert(count===1,label+' duplicate learners '+count);
 await fit('account');
 assert(await page.locator('.onboard__dock button').first().isDisabled(),label+' account gate');
 await page.locator('#account-email').fill('gauntlet@example.invalid');
 if(band!=='adult')await page.locator('.account__parent').click();
 await page.locator('form button[type=submit]').click();await page.locator('#account-code').fill('12345678');await page.locator('form button[type=submit]').click();
 await next();await page.locator('#access-code').waitFor();
 assert(await page.locator('.onboard__dock button').first().isDisabled(),label+' invite gate');
 if(course==='en'&&band==='little'){
  await page.locator('#access-code').fill('invalid-fixture');await page.locator('form button[type=submit]').click();await page.locator('.access--bad').waitFor();assert(await page.locator('.onboard__dock button').first().isDisabled(),label+' invalid code gate');
 }
 await page.locator('#access-code').fill('qa-fixture');await page.locator('form button[type=submit]').click();await page.locator('.access--ok').waitFor();await next();
 await page.getByRole('button',{name:copy['onboarding.ready.skip'],exact:true}).click();await fit('plan');await next();
 await page.locator('.hero').waitFor();
 const state=await page.evaluate(()=>{const s=window.__store.getState();return {profile:s.profiles[s.activeId],settings:s.settings}});
 assert(state.profile.course===course&&state.profile.band===band,label+' profile mismatch');assert(!state.settings.contributeRecordings&&!state.settings.storeRecordings,label+' consent preferences lost');
 await page.reload();await page.locator('.hero').waitFor();assert(!report.errors.length,report.errors.join('\n'));
 report.onboarding.push(label);await context.close();
 if(report.onboarding.length%28===0)console.log('Completed onboarding: '+report.onboarding.length);
}
report.ok=true;
}catch(e){report.error=e.stack;throw e}finally{fs.mkdirSync('.wrangler',{recursive:true});fs.writeFileSync('.wrangler/onboarding-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,completed:report.onboarding.length,error:report.error}));await browser.close()}
