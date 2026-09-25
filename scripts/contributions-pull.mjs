// Pull contributed practice recordings (the ones learners agreed to share) to this machine, to listen to and label.
//   node scripts/contributions-pull.mjs [--limit=200] [--locale=zh-CN] [--since=2026-09-20]
// Rows come from the `contributions` table; the audio from wherever the row says it is — Cloudflare R2 (rows since
// 2026-09-25, through `wrangler r2 object get --remote`) or the Supabase Storage bucket (older rows). Files land in
// eval/contributions/<device>/NNN-<id>.wav with a manifest.csv per device — children's voices: the folder is
// gitignored and must stay out of git. Keys come from the project .env (SUPABASE_SECRET_KEY); nothing prints them.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...Object.fromEntries((existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : '').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })), ...process.env };
const URL_ = (env.SUPABASE_URL || 'https://xzghsihffoliduqkjvck.supabase.co').replace(/\/+$/, '');
const KEY = (env.SUPABASE_SECRET_KEY || '').replace(/[\s\p{Cc}\p{Cf}]+/gu, '');
if (!KEY) { console.error('SUPABASE_SECRET_KEY is not in .env'); process.exit(1); }
const auth = { apikey: KEY, ...(KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${KEY}` }) };
const arg = (name, fallback) => { const hit = process.argv.find((a) => a.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : fallback; };
const limit = Number(arg('limit', '200')), locale = arg('locale', ''), since = arg('since', '');
const BUCKET = 'wunder-tutor-recordings';
const OUT = join(ROOT, 'eval', 'contributions');

const q = new URLSearchParams({ select: 'id,device,locale,band,home_language,reference,overall,audio_path,store,app_version,created_at', order: 'created_at.desc', limit: String(limit) });
if (locale) q.set('locale', `eq.${locale}`);
if (since) q.set('created_at', `gte.${since}`);
const res = await fetch(`${URL_}/rest/v1/contributions?${q}`, { headers: auth });
if (!res.ok) { console.error(`contributions ${res.status}`); process.exit(1); }
const rows = await res.json();
console.log(`${rows.length} contribution${rows.length === 1 ? '' : 's'}${locale ? ` in ${locale}` : ''}${since ? ` since ${since}` : ''}`);

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const byDevice = new Map();
let got = 0, failed = 0;
for (const r of rows) {
  const dir = join(OUT, r.device);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${r.id}.wav`);
  if (!existsSync(file)) {
    try {
      if (r.store === 'r2') {
        execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${r.audio_path}`, '--file', file, '--remote'], { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
      } else {
        const a = await fetch(`${URL_}/storage/v1/object/contributions/${r.audio_path}`, { headers: auth });
        if (!a.ok) throw new Error(`storage ${a.status}`);
        writeFileSync(file, Buffer.from(await a.arrayBuffer()));
      }
      got++;
    } catch (e) { failed++; console.warn(`  ${r.id}: ${e?.message ?? e}`); continue; }
  }
  if (!byDevice.has(r.device)) byDevice.set(r.device, []);
  byDevice.get(r.device).push(r);
}
for (const [device, list] of byDevice) {
  const lines = [['file', 'text', 'locale', 'band', 'home', 'app overall', 'store', 'app version', 'at', 'your label: correct? / what was wrong'].map(csv).join(',')];
  for (const r of list) lines.push([`${r.id}.wav`, r.reference, r.locale, r.band, r.home_language, r.overall, r.store, r.app_version, r.created_at, ''].map(csv).join(','));
  writeFileSync(join(OUT, device, 'manifest.csv'), `﻿${lines.join('\n')}\n`);
  console.log(`  ${device}: ${list.length} → eval/contributions/${device}/`);
}
console.log(`${got} downloaded, ${failed} failed, the rest were already here.`);
