import type { ChildProfile, PhonemeId, SpeakItem } from '../../domain/types';
import { tokenize, wordPhones } from '../../content/lexicon';
import { weakSoundsIn } from '../../intelligence/profile';
import { unitsFor } from '../../speech/zh/assess';
import type { ReadLine } from '../../speech/read';

// A sentence from a photo or typed text, as a practice item: the same speaking screen, scoring and feedback as a
// lesson. The learner's own weak sounds that the sentence contains become its focus, so the likely-mistake checks
// ("sounded like …") look for exactly those.

const hash = (s: string): string => {
  let h = 5381;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 33);
  return (h >>> 0).toString(36);
};
const kindOf = (units: number): SpeakItem['kind'] => (units <= 1 ? 'word' : units <= 4 ? 'phrase' : 'sentence');

export function sayItem(line: ReadLine, p: ChildProfile): SpeakItem | null {
  // A line the checks can't handle is shown as "can't check", never a broken screen.
  try { return build(line, p); } catch { return null; }
}

function build(line: ReadLine, p: ChildProfile): SpeakItem | null {
  if (line.pinyin && line.simplified && line.traditional) {
    const syllables = line.pinyin.split(' ');
    const units = new Set(syllables.flatMap((s) => { const u = unitsFor(s); return [u.initial, u.final, `zh:t${s.slice(-1)}`].filter(Boolean) as string[]; }));
    const focus = weakSoundsIn(p.pronunciation, 'zh').map((s) => s.phoneme).filter((ph) => units.has(ph)).slice(0, 3);
    return {
      id: `say:${hash(line.simplified)}`, text: line.simplified, lang: 'zh-CN', zh: { hant: line.traditional, py: line.pinyin },
      kind: kindOf(syllables.length), focus: focus as PhonemeId[],
    };
  }
  if (line.lang && line.lang !== 'en') return null; // another language, or Chinese without checked pinyin
  if (/\p{Script=Han}/u.test(line.text)) return null; // Chinese without checked pinyin: can't be scored fairly
  const words = tokenize(line.text);
  if (!words.length) return null;
  const sounds = new Set(words.flatMap((w) => wordPhones(w, p.accent).syllables.flatMap((s) => s.phonemes)));
  const focus = weakSoundsIn(p.pronunciation, 'en').map((s) => s.phoneme).filter((ph) => sounds.has(ph)).slice(0, 3);
  return { id: `say:${hash(line.text)}`, text: line.text, kind: kindOf(words.length), focus };
}
