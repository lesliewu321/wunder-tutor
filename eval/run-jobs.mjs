// Runs the Azure scorings listed by an eval script's --plan step (eval/.cache/clip-jobs.json), with plain Node —
// vite-node's network stalls on this machine. Cached, so reruns only score what is missing.
//   node eval/run-jobs.mjs [jobs-file]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assess, CACHE, pool } from './lib.mjs';

const file = process.argv[2] ?? join(CACHE, 'clip-jobs.json');
const jobs = JSON.parse(readFileSync(file, 'utf8'));
let done = 0, failed = 0;
const t0 = Date.now();
await pool(jobs, 6, async (j) => {
  try { await assess({ wav: readFileSync(j.file), reference: j.reference, locale: j.locale }); } catch { failed++; }
  if (++done % 500 === 0) console.log(`${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
});
console.log(`${jobs.length} scorings, ${failed} failed, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
