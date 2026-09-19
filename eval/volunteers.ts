// Real voices: unpack the files volunteers' parents shared from the app (Settings / Parent Zone → Share recordings
// for testing). Put the .json files in eval/volunteers/ — that folder is gitignored and must stay out of git: these
// are children's voices. For each file this writes the recordings as WAV and a manifest to listen to and label.
//   npx vite-node eval/volunteers.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { EXPORT_FORMAT, type RecordingExport } from '../src/data/exportRecordings';

const DIR = join(ROOT, 'eval', 'volunteers');
mkdirSync(DIR, { recursive: true });
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
if (!files.length) console.log(`No files yet. Put shared recording files in ${DIR}`);

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
for (const f of files) {
  const data = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as RecordingExport;
  if (data.format !== EXPORT_FORMAT) { console.log(`${f}: not a Wunder Tutor recordings file — skipped`); continue; }
  const out = join(DIR, data.learner.code);
  mkdirSync(out, { recursive: true });
  const rows = [['file', 'text', 'pinyin', 'locale', 'context', 'at', 'app overall', 'app verdict per word', 'your label: correct? / what was wrong'].map(csv).join(',')];
  data.takes.forEach((t, i) => {
    const name = `${String(i + 1).padStart(3, '0')}-${t.itemId}.wav`;
    writeFileSync(join(out, name), Buffer.from(t.wav, 'base64'));
    const verdict = t.assessment.words.map((w) => {
      const z = w.syllables[0]?.zh;
      const why = z?.toneHeard ? ` heard tone ${z.toneHeard}` : z?.heardAs ? ` sounded like ${z.heardAs}` : w.phonemes.filter((p) => p.heardAs).map((p) => ` ${p.phoneme}→${p.heardAs}`).join('');
      return `${w.word}:${w.errorType === 'none' ? 'ok' : w.errorType}${why}`;
    }).join(' ');
    rows.push([name, t.text, t.py, t.locale, t.context, t.at, t.assessment.overall, verdict, ''].map(csv).join(','));
  });
  writeFileSync(join(out, 'manifest.csv'), `﻿${rows.join('\n')}\n`);
  const { code, age, band, homeLanguage, accent } = data.learner;
  console.log(`${code}: ${data.takes.length} recordings (age ${age}, ${band}, home ${homeLanguage}, ${accent}) → ${out}`);
}
