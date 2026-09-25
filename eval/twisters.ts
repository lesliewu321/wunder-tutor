// Prove each tongue twister before it is offered: the teacher's own take must PASS the scorer (overall at or above the
// pass mark, no word missed) — 四是四，十是十 taught us that a scorer can fail a whole sequence while marking every
// syllable in it perfectly, and a game that fails a child who said it right is worse than no game.
//   npx vite-node eval/twisters.ts            # against the local API (npm run server; keys from .env)
//   npx vite-node eval/twisters.ts --write    # also writes `proven` and `teacherScore` back into content/twisters.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve('content/twisters.json');
const base = process.env.WUNDER_API ?? 'http://localhost:8787';
const write = process.argv.includes('--write');
const data = JSON.parse(readFileSync(FILE, 'utf8')) as { pass: number; twisters: { id: string; locale: string; text: string; proven: boolean; teacherScore?: number; note?: string }[] };

const resample = (wav24: Buffer): Buffer => {
  const dataAt = wav24.indexOf('data'); const rateIn = wav24.readUInt32LE(24); const chans = wav24.readUInt16LE(22);
  const pcm = wav24.subarray(dataAt + 8); const n = Math.floor(pcm.length / 2 / chans);
  const ratio = rateIn / 16000; const outN = Math.floor(n / ratio); const out = Buffer.alloc(44 + outN * 2);
  for (let i = 0; i < outN; i++) { const p = i * ratio, a = Math.floor(p), b = Math.min(a + 1, n - 1), f = p - a; const s0 = pcm.readInt16LE(a * 2 * chans), s1 = pcm.readInt16LE(b * 2 * chans); out.writeInt16LE(Math.round(s0 + (s1 - s0) * f), 44 + i * 2); }
  out.write('RIFF', 0); out.writeUInt32LE(36 + outN * 2, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(16000, 24); out.writeUInt32LE(32000, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(outN * 2, 40);
  return out;
};

for (const tw of data.twisters) {
  try {
    let res = await fetch(`${base}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: tw.text, locale: tw.locale }) });
    if (!res.ok) { console.log(`${tw.id}: no voice (${res.status})`); tw.proven = false; tw.note = `no voice ${res.status}`; continue; }
    const wav = resample(Buffer.from(await res.arrayBuffer()));
    res = await fetch(`${base}/api/assess?text=${encodeURIComponent(tw.text)}&locale=${tw.locale}`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav });
    const j = await res.json();
    const best = j.NBest?.[0];
    if (!res.ok || j.RecognitionStatus !== 'Success' || !best) { console.log(`${tw.id}: scorer said ${j.RecognitionStatus ?? j.error}`); tw.proven = false; tw.note = String(j.RecognitionStatus ?? j.error); continue; }
    const overall = Math.round(best.PronunciationAssessment?.AccuracyScore ?? best.AccuracyScore ?? 0);
    const missed = (best.Words ?? []).filter((w: { ErrorType?: string }) => w.ErrorType === 'Omission').map((w: { Word: string }) => w.Word);
    const low = (best.Words ?? []).map((w: { Word: string; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }) => `${w.Word}:${Math.round(w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore ?? 0)}`).join(' ');
    tw.teacherScore = overall;
    tw.proven = overall >= data.pass && missed.length === 0;
    tw.note = tw.proven ? undefined : `teacher ${overall}${missed.length ? `, missed ${missed.join(' ')}` : ''}`;
    console.log(`${tw.proven ? 'PROVEN ' : 'not    '} ${tw.id}: teacher ${overall}${missed.length ? ` (missed ${missed.join(', ')})` : ''}  ${low}`);
  } catch (e) { console.log(`${tw.id}: ${(e as Error).message}`); tw.proven = false; tw.note = (e as Error).message; }
}
if (write) { writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n'); console.log('written'); }
console.log(`${data.twisters.filter((t) => t.proven).length} of ${data.twisters.length} proven`);
