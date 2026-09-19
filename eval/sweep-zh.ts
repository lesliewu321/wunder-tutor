// Operating-point sweep for the Mandarin checks: how false alarms trade against detection as the tone verdict and
// the "sounded like" margin get stricter. Held-out tone models (--cv), cached data only.
//   npx vite-node eval/sweep-zh.ts
import { DEFAULT_TONE_PARAMS } from '../src/speech/zh/tone';
import { ZH_ALT_MARGIN } from '../src/speech/zh/assess';
import { report } from './run-zh';

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);
const row = (label: string, s: ReturnType<typeof report>) =>
  console.log(`${label.padEnd(40)} FA ${pct(s.falseAlarmItems)} (alone ${pct(s.alone.falseAlarms)}, phrase ${pct(s.inPhrase.falseAlarms)})  tone caught ${pct(s.toneDetect)} (alone ${pct(s.alone.toneDetect)}, phrase ${pct(s.inPhrase.toneDetect)})  sound caught ${pct(s.segDetect)}`);

row('current', report({ cv: true, quiet: true }));
const base = DEFAULT_TONE_PARAMS;
for (const scorerDoubt of [88, 90, 92]) row(`all: scorerDoubt ${scorerDoubt}`, report({ cv: true, quiet: true, params: { ...base, scorerDoubt } }));
for (const scorerDoubt of [85, 88, 90]) {
  for (const maxExpected of [0.3, 0.4]) {
    row(`in phrases: scorerDoubt ${scorerDoubt} maxExp ${maxExpected}`, report({ cv: true, quiet: true, params: { ...base, connected: { scorerDoubt, maxExpected } } }));
  }
}
for (const altMargin of [ZH_ALT_MARGIN + 2, ZH_ALT_MARGIN + 4]) row(`altMargin ${altMargin}`, report({ cv: true, quiet: true, altMargin }));
