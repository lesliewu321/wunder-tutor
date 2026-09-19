// A new learner's first Mandarin takes, before the app knows their voice: how do tone checks fare when the only
// reference is the take itself? Compare with the app's voice profile and with pooled statistics.
//   npx vite-node eval/cold-zh.ts
import { report } from './run-zh';

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);
const row = (label: string, s: ReturnType<typeof report>) =>
  console.log(`${label.padEnd(30)} FA ${pct(s.falseAlarmItems)} (alone ${pct(s.alone.falseAlarms)}, phrase ${pct(s.inPhrase.falseAlarms)})  tone caught ${pct(s.toneDetect)} (alone ${pct(s.alone.toneDetect)}, phrase ${pct(s.inPhrase.toneDetect)})  tone FA/syl ${pct(s.toneFalse)}`);

row('pooled statistics', report({ cv: true, quiet: true, speaker: 'pooled' }));
row('voice profile (app)', report({ cv: true, quiet: true, speaker: 'profile' }));
row('cold: this take only', report({ cv: true, quiet: true, speaker: 'cold' }));

