#!/usr/bin/env node
// Copy the service keys from the local .env to the live app (Cloudflare Pages secrets) — without pasting.
//
//   node scripts/push-keys.mjs            check the keys in .env, then upload the ones that work
//   node scripts/push-keys.mjs --check    only check them; upload nothing
//
// Why: pasting into wrangler's hidden prompt went wrong three times in a row (an invalid value, a value with a line
// break inside, an empty value), and each time the live app failed in a way that looked like a camera problem. The
// keys in .env are known to work (the local server uses them), so this reads them from there, asks Microsoft and
// Google whether each one works, and uploads only working keys. It never prints a key — only names, lengths and ✓/✗.
// A new deploy is needed afterwards (`npm run deploy`); then https://app.wundertutor.com/api/status must say "ok".
import { spawn, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qwenHost } from '../server/qwen-endpoint.mjs';

const PROJECT = 'wunder-tutor';
const NAMES = ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'GEMINI_API_KEY'];
// Families' accounts (server/family.mjs): optional — without it the app works as before, accounts just have no plans or daily limits.
const OPTIONAL = ['SUPABASE_SECRET_KEY', 'DASHSCOPE_API_KEY', 'GOOGLE_CLOUD_TTS_API_KEY'];
const SUPABASE_URL = 'https://xzghsihffoliduqkjvck.supabase.co'; // public (also in wrangler.toml)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const selfTest = process.argv.includes('--self-test'); // uploads one harmless dummy value, to prove the upload works

/** Same rules as server/index.mjs: a later line wins, and an empty `KEY=` never shadows a filled-in one. */
function readEnv(path) {
  const out = new Map();
  for (const line of readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    v = (q === '"' || q === "'") && v.endsWith(q) && v.length >= 2 ? v.slice(1, -1) : v.replace(/\s+#.*$/, '').trim();
    if (v !== '' || !out.has(m[1])) out.set(m[1], v);
  }
  return out;
}

const ask = async (url, init) => {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
    let message = '';
    if (!res.ok) { try { message = String((await res.json())?.error?.message ?? ''); } catch { /* no body */ } }
    return { ok: res.ok, status: res.status, message };
  } catch (e) {
    return { ok: false, status: 0, message: `${e?.name ?? 'error'}: could not reach the service` };
  }
};

function upload(values) {
  const wrangler = join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'wrangler', 'bin', 'wrangler.js');
  return new Promise((done) => {
    // The values go to wrangler through its input, never onto the command line or into a file.
    const child = spawn(process.execPath, [wrangler, 'pages', 'secret', 'bulk', '--project-name', PROJECT], { cwd: root, stdio: ['pipe', 'inherit', 'inherit'] });
    child.on('error', () => done(false));
    child.on('exit', (code) => done(code === 0));
    child.stdin.end(JSON.stringify(values));
  });
}

if (selfTest) {
  console.log('Uploading one harmless test value (WT_UPLOAD_TEST) to prove the upload works…');
  process.exit((await upload({ WT_UPLOAD_TEST: `ok-${Date.now()}` })) ? 0 : 1);
}

const env = readEnv(join(root, '.env'));
const values = Object.fromEntries(NAMES.map((n) => [n, env.get(n) ?? '']));
let good = true;
console.log('Keys in .env (never shown — only their length):');
for (const n of NAMES) {
  const v = values[n];
  const clean = /^[!-~]+$/.test(v);
  console.log(`  ${n.padEnd(20)} ${v ? `${String(v.length).padStart(3)} characters${clean ? '' : ' — has spaces or odd characters'}` : 'MISSING'}`);
  if (!v || !clean) good = false;
}
for (const n of OPTIONAL) {
  const v = env.get(n) ?? '';
  const clean = /^[!-~]+$/.test(v);
  console.log(`  ${n.padEnd(20)} ${v ? `${String(v.length).padStart(3)} characters${clean ? '' : ' — has spaces or odd characters'}` : 'not set (optional service)'}`);
  if (v && !clean) good = false;
  if (v && clean) values[n] = v;
}
if (!good) { console.log('\n✗ Fix the lines above in .env first. Nothing was uploaded.'); process.exit(1); }

console.log('\nAsking the services whether these keys work…');
const azure = await ask(`https://${values.AZURE_SPEECH_REGION.toLowerCase()}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': values.AZURE_SPEECH_KEY }, body: '' });
const google = await ask('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash', { headers: { 'x-goog-api-key': values.GEMINI_API_KEY } });
console.log(`  Pronunciation scoring (Microsoft Azure): ${azure.ok ? '✓ works' : `✗ refused (${azure.status || 'no answer'}) ${azure.message}`}`);
console.log(`  Reading pages + teacher voice (Google):  ${google.ok ? '✓ works' : `✗ refused (${google.status || 'no answer'}) ${google.message}`}`);
let supabaseOk = true;
if (values.SUPABASE_SECRET_KEY) {
  const k = values.SUPABASE_SECRET_KEY;
  const supabase = await ask(`${SUPABASE_URL}/rest/v1/plans?select=parent_id&limit=1`, { headers: { apikey: k, ...(k.startsWith('sb_') ? {} : { Authorization: `Bearer ${k}` }) } });
  supabaseOk = supabase.ok;
  console.log(`  Family accounts (Supabase secret key):   ${supabase.ok ? '✓ works' : `✗ refused (${supabase.status || 'no answer'}) ${supabase.message} — it must be the SECRET key (sb_secret_…), not the publishable one`}`);
}
let voicesOk = true;
if (values.DASHSCOPE_API_KEY) {
  const region = env.get('QWEN_TTS_REGION') || 'singapore';
  const host = qwenHost(region);
  if (!host) { console.log('  QWEN_TTS_REGION must be qwencloud, singapore or beijing.'); voicesOk = false; }
  else {
    values.QWEN_TTS_REGION = region;
    const check = await ask('https://' + host + '/compatible-mode/v1/models', { redirect: 'error', headers: { Authorization: 'Bearer ' + values.DASHSCOPE_API_KEY } });
    console.log('  Qwen key access: ' + (check.ok ? 'works (TTS model access still needs a voice preview)' : 'refused (' + check.status + ')'));
    voicesOk = voicesOk && check.ok;
  }
}
if (values.GOOGLE_CLOUD_TTS_API_KEY) {
  const check = await ask('https://texttospeech.googleapis.com/v1/voices?languageCode=en-US', { headers: { 'x-goog-api-key': values.GOOGLE_CLOUD_TTS_API_KEY } });
  console.log('  Google Cloud TTS: ' + (check.ok ? 'voice list accessible' : 'refused (' + check.status + ')'));
  voicesOk = voicesOk && check.ok;
}
if (!azure.ok || !google.ok || !supabaseOk || !voicesOk) { console.log('\n✗ A key in .env does not work, so nothing was uploaded.'); process.exit(1); }
if (checkOnly) { console.log('\n✓ They work. (--check: nothing was uploaded.)'); process.exit(0); }

console.log(`\nUploading ${Object.keys(values).join(', ')} to the live app (${PROJECT})…`);
if (!(await upload(values))) { console.log('\n✗ The upload failed — see the message above. Nothing else was changed.'); process.exit(1); }
console.log('\n✓ Uploaded. The live app uses them after the next deploy:  npm run deploy');
console.log('  Then this must say "ok" three times:  https://app.wundertutor.com/api/status');
