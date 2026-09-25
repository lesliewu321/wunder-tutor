import fs from 'node:fs';import {createRequire} from 'node:module';
const code=fs.readFileSync(0,'utf8').trim();if(!code)throw Error('Invite required on stdin');
const require=createRequire('C:/Users/Leslie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
const samples=[['en-US','Hello, my friend.'],['en-GB','Hello, my friend.'],['zh-CN','你好。'],['zh-HK','多謝。'],['ja-JP','こんにちは。'],['ko-KR','안녕하세요.'],['fr-FR','Bonjour mon ami.'],['es-ES','Hola, amigo.']];
const report={ok:false,normal:[],backup:[],errors:[]};
try{for(const fallback of [false,true]){
 const context=await browser.newContext(),page=await context.newPage(),calls=[];
 await context.addInitScript(()=>Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined}));
 page.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/api/**',async route=>{const request=route.request(),path=new URL(request.url()).pathname;
  if(!['/api/health','/api/tts'].includes(path))return route.fulfill({json:{}});
  const b=request.postDataJSON();if(path==='/api/tts'){calls.push({provider:b.provider,accent:b.accent});if(fallback&&b.provider===(b.accent.startsWith('zh')?'qwen':'chirp'))return route.fulfill({status:500,json:{error:'internal_error'}});}
  const r=await fetch('https://app.wundertutor.com'+path,{method:request.method(),headers:{'content-type':'application/json','x-wunder-access':encodeURIComponent(code)},body:request.postData()||undefined,signal:AbortSignal.timeout(45000)});
  await route.fulfill({status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/json','x-tts-voice':r.headers.get('x-tts-voice')||''},body:Buffer.from(await r.arrayBuffer())});
 });
 await page.goto('http://127.0.0.1:5176');await page.waitForFunction(()=>window.__store);
 for(const [accent,text]of samples){const before=calls.length;await page.evaluate(async({accent,text})=>{const {voice}=await import('/src/speech/voice.ts');await voice.speak(text,{accent});},{accent,text});const row={accent,providers:calls.slice(before).map(c=>c.provider),playedToEnd:true};(fallback?report.backup:report.normal).push(row);console.log(JSON.stringify({mode:fallback?'backup':'normal',...row}));}
 await context.close();
}report.ok=!report.errors.length&&report.backup.every(x=>x.providers.length===2);}catch(e){report.error=e.message}finally{await browser.close();fs.writeFileSync('.wrangler/live-client-voice-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error,errors:report.errors}));process.exitCode=report.ok?0:1;}
