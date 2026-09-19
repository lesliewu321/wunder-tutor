// Tone check for the teacher's own Mandarin recordings (src/speech/zh/teacherCheck.ts): the teacher is the Kore voice,
// so its profile is fixed. How often would a CORRECT teacher take be thrown away, and how often is a take that says
// the wrong character (a different tone) caught?  npx vite-node eval/teacher-check.ts
import { parseSyllable } from '../src/content/zh/pinyin';
import { toneClearlyWrong } from '../src/speech/zh/teacherCheck';
import { pitchFor, profileSpeakers, zhCases } from './zh-common';

const ref = profileSpeakers.get('Kore|1')!;
console.log(`Kore profile: median ${ref.median.toFixed(1)}, spread ${ref.spread?.toFixed(1)}, takes ${ref.takes}`);
let ok = 0, okN = 0, caught = 0, wrongN = 0;
const seen = new Set<string>();
for (const c of zhCases) {
  if (c.voice !== 'Kore' || c.speed !== 1 || (c.kind !== 'pair' && c.kind !== 'pair-reverse')) continue;
  const key = `${c.reference}|${c.spoken}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const want = parseSyllable(c.refPy!).tone, said = parseSyllable(c.spokenPy!).tone;
  if (want === 5) continue;
  const rejected = toneClearlyWrong(pitchFor(c), want as 1 | 2 | 3 | 4, ref);
  if (c.truth.correct) { okN++; if (rejected) console.log(`  correct take rejected: ${c.reference}`); else ok++; }
  else if (want !== said) { wrongN++; if (rejected) caught++; }
}
console.log(`correct takes kept: ${ok}/${okN}; wrong-tone takes caught: ${caught}/${wrongN}`);
