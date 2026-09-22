#!/usr/bin/env node
// Every line the app can ask the teacher for, made once — so no learner waits ten seconds for a hard line, and every
// line that the teacher cannot say has its backup take ready. Also the plainest test that every line HAS a voice.
//
//   npx vite-node eval/voice-lines.ts                     first: the list of lines (eval/.cache/voice-lines.json)
//   node scripts/warm-voice.mjs                           in this process, keys from .env, takes into server/.cache/tts
//   node scripts/warm-voice.mjs --slow                    the slow takes too (twice the lines)
//   node scripts/warm-voice.mjs --only=zh-CN,fr-FR        some languages only
//   node scripts/warm-voice.mjs --server=https://app.wundertutor.com     through a running server instead (the
//                                   invite code from WUNDER_CODE, sent only in the header the app uses; paced under
//                                   the server's own limits, so slow: ~120 new takes per 10 minutes)
//   node scripts/warm-voice.mjs --push                    copy the takes made here into the live server's cache (the
//                                   KV namespace wunder-tutor-tts-cache, through wrangler): the same keys, since the
//                                   model and voice are the same, so learners everywhere get them at once. Only
//                                   with Leslie's go-ahead: it writes to production.
//
// Prints one line per take (voice, cache, time) and, at the end, the lines that stayed silent — those are the bugs.
// Never prints a key.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const slow = args.includes('--slow');
const only = flag('only')?.split(',');
const server = flag('server');
const cacheDir = join(root, 'server', '.cache', 'tts');

if (args.includes('--push')) {
  // Every take on disk, in batches (a bulk write is capped at 100 MB; a take is 50–300 KB), as the hosted API keys them.
  const KV = '138ec3dd03034f40ab92a58125cd6b07'; // wunder-tutor-tts-cache (npx wrangler kv namespace list)
  const files = readdirSync(cacheDir).filter((f) => f.endsWith('.wav'));
  const tmp = mkdtempSync(join(tmpdir(), 'wunder-kv-'));
  let batch = [], size = 0, pushed = 0;
  const flush = () => {
    if (!batch.length) return;
    const file = join(tmp, `batch-${pushed}.json`);
    writeFileSync(file, JSON.stringify(batch));
    execFileSync('npx', ['wrangler', 'kv', 'bulk', 'put', file, '--namespace-id', KV], { stdio: 'inherit', shell: process.platform === 'win32' });
    pushed += batch.length;
    console.log(`  ${pushed}/${files.length} takes in the live cache`);
    batch = []; size = 0;
  };
  for (const f of files) {
    const wav = readFileSync(join(cacheDir, f));
    batch.push({ key: `tts:${f.slice(0, -4)}`, value: wav.toString('base64'), base64: true });
    size += wav.length;
    if (batch.length >= 200 || size > 60e6) flush();
  }
  flush();
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${pushed} takes copied to the live cache.`);
  process.exit(0);
}

const lines = JSON.parse(readFileSync(join(root, 'eval', '.cache', 'voice-lines.json'), 'utf8'))
  .filter((l) => !only || only.includes(l.accent));
const takes = lines.flatMap((l) => (slow ? [{ ...l, slow: false }, { ...l, slow: true }] : [{ ...l, slow: false }]));

/** The API in this process (keys from .env, the disk cache the local server uses) — or a server over HTTP. */
async function speaker() {
  if (server) {
    const code = process.env.WUNDER_CODE;
    const headers = { 'Content-Type': 'application/json', Origin: 'https://localhost', ...(code ? { 'x-wunder-access': encodeURIComponent(code) } : {}) };
    return async (take) => {
      const res = await fetch(`${server}/api/tts`, { method: 'POST', headers, body: JSON.stringify({ text: take.text, accent: take.accent, slow: take.slow, kind: take.kind }) });
      if (!res.ok) return { error: `${res.status} ${(await res.text()).replace(/\s+/g, ' ').slice(0, 60)}` };
      await res.arrayBuffer();
      return { voice: res.headers.get('x-tts-voice'), cache: res.headers.get('x-tts-cache') };
    };
  }
  const { env } = await import('../eval/lib.mjs');
  const { createApi } = await import('../server/core.mjs');
  const ttsCache = {
    get: (key) => readFile(join(cacheDir, `${key}.wav`)).catch(() => null),
    put: async (key, wav) => { await mkdir(cacheDir, { recursive: true }); await writeFile(join(cacheDir, `${key}.wav`), wav); },
  };
  const api = createApi({ ...env, BETA_ACCESS_CODE: '' }, { ttsCache, ttsGenerationsPerWindow: 100000, log: { warn: (m) => console.log(`      ${m}`) } });
  return async (take) => {
    const res = await api.handle(new Request('http://local/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: take.text, accent: take.accent, slow: take.slow, kind: take.kind }) }), { clientId: `warm-${Math.random()}` });
    if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 60)}` };
    await res.arrayBuffer();
    return { voice: res.headers.get('x-tts-voice'), cache: res.headers.get('x-tts-cache') };
  };
}

const speak = await speaker();
const silent = [];
const counts = { teacher: 0, backup: 0, hit: 0 };
let done = 0;
const started = Date.now();
// A few at a time: each new take is a Live session of its own; more than this and Google starts refusing sessions.
const width = server ? 2 : 3;
const queue = [...takes];
await Promise.all(Array.from({ length: width }, async () => {
  for (let take = queue.shift(); take; take = queue.shift()) {
    const t0 = Date.now();
    let r;
    try { r = await speak(take); } catch (e) { r = { error: String(e?.message ?? e) }; }
    const ms = Date.now() - t0;
    done += 1;
    if (r.error) silent.push({ ...take, error: r.error });
    else { counts[r.voice] = (counts[r.voice] ?? 0) + 1; if (r.cache === 'hit') counts.hit += 1; }
    console.log(`${String(done).padStart(4)}/${takes.length} ${take.accent} ${take.slow ? 'slow  ' : 'normal'} ${(r.error ? 'SILENT ' + r.error : `${r.voice} ${r.cache}`).padEnd(16)} ${String(ms).padStart(6)} ms  ${take.text}`);
    // Through a server: stay under its per-address limit and its generation budget.
    if (server && r.cache !== 'hit') await new Promise((res) => setTimeout(res, 5000));
  }
}));

console.log(`\n${takes.length} takes in ${Math.round((Date.now() - started) / 1000)} s: teacher ${counts.teacher}, backup ${counts.backup} (${counts.hit} already made), silent ${silent.length}`);
for (const s of silent) console.log(`  SILENT ${s.accent} ${s.slow ? 'slow' : ''} ${s.text}  ← ${s.error}  (${s.where})`);
writeFileSync(join(root, 'eval', '.cache', 'warm-voice-result.json'), JSON.stringify({ at: new Date().toISOString(), slow, only, server: server ?? null, counts, silent }, null, 1));
process.exit(0);
