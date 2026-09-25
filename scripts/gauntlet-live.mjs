// Invite comes from stdin only. The report never stores headers, credentials or audio.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {readWav} from '../server/azure-tts.mjs';
const code=fs.readFileSync(0,'utf8').trim(),origin='https://app.wundertutor.com';
if(!code)throw Error('Provide invite on stdin');
const headers={'x-wunder-access':encodeURIComponent(code),'Content-Type':'application/json'};
const report={ok:false,at:new Date().toISOString(),speech:[],assessments:[],reading:[]};
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/Leslie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage();
const samples=[['en-US','Hello, my friend.'],['en-GB','Hello, my friend.'],['zh-CN','你好。'],['zh-HK','多謝。'],['ja-JP','こんにちは。'],['ko-KR','안녕하세요.'],['fr-FR','Bonjour mon ami.'],['es-ES','Hola, amigo.']];
const wav16=({pcm,rate})=>{const n=Math.floor(pcm.length/2*16000/rate),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(pcm.readInt16LE(Math.min(pcm.length-2,Math.floor(i*rate/16000)*2)),44+i*2);return b};
try{
 const h=await fetch(origin+'/api/health',{headers,signal:AbortSignal.timeout(20000)});const health=await h.json();report.health={http:h.status,authorized:health.authorized,codeAccepted:health.codeAccepted,voiceProviders:health.voiceProviders};if(!health.authorized)throw Error('Invite not authorized');
 for(const provider of ['qwen','chirp','azure'])for(const [accent,text]of samples){
  const r=await fetch(origin+'/api/tts',{method:'POST',headers,body:JSON.stringify({provider,accent,text}),signal:AbortSignal.timeout(45000)}),row={provider,accent,http:r.status,voice:r.headers.get('x-tts-voice')};
  if(r.ok){const bytes=Buffer.from(await r.arrayBuffer()),audio=readWav(bytes);let peak=0;for(let i=0;i<audio.pcm.length-1;i+=2)peak=Math.max(peak,Math.abs(audio.pcm.readInt16LE(i)));Object.assign(row,{bytes:bytes.length,seconds:audio.pcm.length/2/audio.rate,peak});
   row.played=await page.evaluate(async b64=>{const a=new Audio(URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'audio/wav'})));return new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),12000);a.onended=()=>{clearTimeout(timer);URL.revokeObjectURL(a.src);resolve(true)};a.onerror=()=>{clearTimeout(timer);resolve(false)};a.play().catch(()=>{clearTimeout(timer);resolve(false)})})},bytes.toString('base64'));
   if(provider==='azure'){const score=await fetch(origin+'/api/assess?'+new URLSearchParams({text,locale:accent}),{method:'POST',headers:{...headers,'Content-Type':'audio/wav'},body:wav16(audio),signal:AbortSignal.timeout(40000)});const data=await score.json();report.assessments.push({accent,http:score.status,status:data.RecognitionStatus,hasScores:(data.NBest?.[0]?.AccuracyScore!=null||!!data.NBest?.[0]?.PronunciationAssessment)});}
  }else {const e=await r.json().catch(()=>({}));row.error=e.error;}
  report.speech.push(row);console.log(JSON.stringify(row));
 }
 for(const text of ['Hello world. I like apples.','你好。我喜歡蘋果。']){const r=await fetch(origin+'/api/read',{method:'POST',headers,body:JSON.stringify({text}),signal:AbortSignal.timeout(45000)}),j=await r.json();report.reading.push({kind:'typed',http:r.status,language:j.language,lines:j.lines?.length,pinyin:j.lines?.filter(x=>x.lang==='zh').every(x=>x.pinyin&&x.traditional&&x.simplified),error:j.error});}
 await page.setContent('<html><body style="font:48px Arial;padding:40px">Hello world.<br>I like apples.</body></html>');const picture=await page.screenshot();const read=await fetch(origin+'/api/read',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:picture,signal:AbortSignal.timeout(45000)}),j=await read.json();report.reading.push({kind:'photo',http:read.status,language:j.language,lines:j.lines?.length,error:j.error});
 report.ok=report.speech.length===24&&report.speech.every(x=>x.http===200&&x.peak>0&&x.played&&x.voice===x.provider)&&report.assessments.every(x=>x.http===200&&x.hasScores)&&report.reading.every(x=>x.http===200&&x.lines>0);
}catch(e){report.error=e.name+': '+e.message}finally{await browser.close();fs.writeFileSync('.wrangler/live-gauntlet-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,health:report.health,assessments:report.assessments,reading:report.reading,error:report.error}));process.exitCode=report.ok?0:1}
