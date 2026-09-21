// Which course lines does the teacher's voice get to say, and what does the gate that decides it cost?
//
//   node eval/teacher-gate.mjs            the gate as the server has it, and the lines it silences
//   node eval/teacher-gate.mjs --sweep    the same over a range of thresholds, before moving one
//
// Free: it reads the Gemini takes and Azure scorings the eval set already cached — no calls, no spend.
//
// What the gate is for. A model recording that says the line wrongly teaches it wrongly, so a take that does not
// score as its own text is thrown away and the line stays silent. In production it runs AFTER the transcript check,
// which already discards a take that said different WORDS. Its real job is therefore the narrower one: catch a take
// that says the right syllable with the wrong TONE. Judging it on every wrong-character take in the eval set
// flatters it; this script splits the two apart and reports them separately.
//
// Found by running it (2026-09-21): six course lines had no voice at all, among them 四是四，十是十。 — which is
// simply the hardest line in the course to say, and which Leslie met on a phone as a lesson that would not speak.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE = join(resolve(dirname(fileURLToPath(import.meta.url))), '.cache');
const cases = JSON.parse(readFileSync(join(CACHE, 'dataset-zh.json'), 'utf8')).cases;

/** zh-CN names each scored unit as pinyin with its tone digit, "si 4". 5 is the neutral (light) tone. */
const toneOf = (unit) => Number(/(\d)\s*$/.exec(String(unit ?? ''))?.[1] ?? 0);
const basePinyin = (py) => String(py ?? '').replace(/\d/g, '').trim();

function measure(j) {
  if (j?.RecognitionStatus !== 'Success') return null;
  const best = j.NBest?.[0];
  const pa = best?.PronunciationAssessment ?? best ?? {};
  const words = best?.Words ?? [];
  const units = words.flatMap((w) => (w.Phonemes?.length ? w.Phonemes : [w]).map((p) => ({
    unit: p.Phoneme ?? w.Word,
    score: (p.PronunciationAssessment ?? p).AccuracyScore ?? 0,
    error: (w.PronunciationAssessment ?? w).ErrorType ?? 'None',
  })));
  return { accuracy: pa.AccuracyScore ?? 0, units };
}

/** The gate exactly as server/core.mjs has it. Keep the two in step. */
const gate = (minAccuracy, minSyllable) => (m) => {
  if (m === null) return false;
  if (m.units.some((u) => u.error === 'Omission')) return false;
  const counted = m.units.filter((u) => toneOf(u.unit) !== 5);
  if (!counted.length) return false;
  return m.accuracy >= minAccuracy && counted.every((u) => u.score >= minSyllable);
};
/** What the server used to do, for comparison. */
const before = (m) => m !== null && m.units.every((u) => u.error === 'None') && m.accuracy >= 85 && m.units.every((u) => u.score >= 70);

const lines = [], wrongTone = [], wrongWord = [];
const seen = new Set();
for (const c of cases) {
  if (c.voice === 'Kore' && c.speed === 1 && c.kind === 'lesson' && !seen.has(c.reference)) {
    seen.add(c.reference);
    lines.push({ ref: c.reference, m: measure(c.azure) });
  }
  if ((c.kind === 'pair' || c.kind === 'pair-reverse') && c.truth?.correct === false && c.reference !== c.spoken) {
    const row = { ref: c.reference, m: measure(c.azure) };
    (c.refPy && c.spokenPy && basePinyin(c.refPy) === basePinyin(c.spokenPy) ? wrongTone : wrongWord).push(row);
  }
}

const score = (g) => ({
  kept: lines.filter((x) => g(x.m)).length,
  tone: wrongTone.filter((x) => !g(x.m)).length,
  word: wrongWord.filter((x) => !g(x.m)).length,
});
const row = (name, g) => {
  const s = score(g);
  console.log(`${name.padEnd(34)} lines with a voice ${String(s.kept).padStart(3)}/${lines.length}   wrong tone refused ${String(s.tone).padStart(3)}/${wrongTone.length}   wrong word refused ${String(s.word).padStart(3)}/${wrongWord.length}`);
};

console.log(`course lines ${lines.length} · wrong-tone takes ${wrongTone.length} · wrong-word takes ${wrongWord.length}\n`);
row('before (acc 85, syllable 70)', before);
row('now (acc 85, syllable 55)', gate(85, 55));

if (process.argv.includes('--sweep')) {
  console.log('');
  for (const accuracy of [85, 80, 78, 75]) {
    for (const syllable of [70, 65, 60, 55, 50]) row(`acc ${accuracy}, syllable ${syllable}`, gate(accuracy, syllable));
  }
}

const now = gate(85, 55);
const silent = lines.filter((x) => !now(x.m));
console.log(`\nStill without a voice (${silent.length}). A learner meets these as a line that will not play:`);
for (const x of silent) {
  const counted = (x.m?.units ?? []).filter((u) => toneOf(u.unit) !== 5);
  const worst = counted.reduce((a, b) => (b.score < a.score ? b : a), { unit: '-', score: 100 });
  console.log(`  ${x.ref.padEnd(16)} accuracy ${String(Math.round(x.m?.accuracy ?? 0)).padStart(3)}   worst syllable ${worst.unit} ${Math.round(worst.score)}`);
}
