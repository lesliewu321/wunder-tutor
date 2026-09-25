import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
const base=path.dirname(fileURLToPath(import.meta.url));
const plans=JSON.parse(fs.readFileSync(path.join(base,'download-plan.json'),'utf8'));
const manifestFile=path.join(base,'downloads.json');
const records=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):[];
const save=()=>fs.writeFileSync(manifestFile,JSON.stringify(records,null,2)+'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let cursor=0;
async function worker(){while(cursor<plans.length){
 const p=plans[cursor++], target=path.resolve(base,p.file);
 if(!target.startsWith(path.resolve(base)+path.sep))throw Error('Unsafe target');
 const prior=records.find(x=>x.file===p.file);
 if(prior?.status==='downloaded' && fs.existsSync(target) && sha(fs.readFileSync(target))===prior.sha256){console.log('Verified existing '+p.file);continue;}
 try{
 console.log('Downloading '+p.file);
 const r=await fetch(p.url,{signal:AbortSignal.timeout(720000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const b=Buffer.from(await r.arrayBuffer());
 if(p.file.endsWith('.pdf') ? b.subarray(0,5).toString()!=='%PDF-' : b.subarray(0,2).toString()!=='PK')throw Error('Response does not match expected document format');
 if(b.length<1000)throw Error('Unexpectedly short PDF');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);
 const rec={...p,status:'downloaded',resolvedUrl:r.url,retrieved:new Date().toISOString().slice(0,10),bytes:b.length,sha256:sha(b)};
 const i=records.findIndex(x=>x.file===p.file);if(i<0)records.push(rec);else records[i]=rec;
 save();console.log('Saved '+p.file+' ('+(b.length/1048576).toFixed(1)+' MiB)');
 }catch(e){const rec={...p,status:'failed',error:e.message};const i=records.findIndex(x=>x.file===p.file);if(i<0)records.push(rec);else records[i]=rec;save();console.log('FAILED '+p.file+': '+e.message);}
}}
await Promise.all([worker(),worker(),worker()]);
if(records.some(r=>plans.some(p=>p.file===r.file) && r.status!=='downloaded'))process.exitCode=1;
