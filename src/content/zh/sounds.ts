import type { HomeLanguage, PhonemeId } from '../../domain/types';
import type { MouthPose, PhonemeInfo } from '../phonemes';

// The Mandarin "sounds" a Hong Kong child practises: the four tones, and the sound groups Cantonese speakers find
// hardest in Putonghua. Same shape as the English catalogue so the Lab, drills and progress work unchanged.
// An English speaker at home (`en`) meets the same list from the other side: the tones are the whole difficulty
// (English has no lexical tone — the 3rd tone worst, then the 2nd, which sounds like a question), then ü, which English
// lacks, and the three sibilant sets, which English collapses into its own sh/ch/j and s/ts; n/l is no trouble at all.
//
// The wording is the English source. Other App languages translate it in src/i18n/<language>/content.json under
// `sound.zh:…` (read by `phonemeInfo` in ../phonemes). A translation quotes characters the way they are written here —
// in Simplified, like the scorer — and `phonemeInfo` shows them in the learner's script, as it does for the English.

const pose = (p: Partial<MouthPose>): MouthPose => ({ open: 0.3, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: true, ...p });
type L1 = Partial<Record<HomeLanguage, { boost: number; heardAs?: PhonemeId }>>;
const yue = (boost: number, heardAs?: PhonemeId): L1 => ({ yue: { boost, heardAs } });
/** Cantonese and English priors side by side: `l1(yue(0.05), 0.2)` — the English boost has no "heard as" because Azure names no substitute for a tone or a vowel it did not hear. */
const l1 = (cantonese: L1, enBoost: number): L1 => ({ ...cantonese, en: { boost: enBoost } });

export const ZH_SOUNDS: PhonemeInfo[] = [
  {
    id: 'zh:t1', label: 'ā', name: 'Tone 1 · high and flat', example: '妈 mā', category: 'tone', contour: [5, 5, 5, 5, 5],
    pose: pose({ open: 0.45, spread: 0.3 }),
    tip: {
      little: 'Sing it high and keep it flat — like a long “beeep”!',
      junior: 'Start high and stay high, flat as a straight line. Don’t let it drop at the end.',
      teen: 'Hold a high, level pitch from start to finish (5-5). Keep it high even at the end of a phrase.',
    },
    steps: ['Start high', 'Stay level', 'Don’t drop at the end'],
    problem: 'Tone 1 should stay high and flat.',
    detail: 'First tone, Chao 55: high and level. Cantonese has high level tones too, but learners often start it too low or let it sag.',
    difficulty: 0.45, l1: l1(yue(0.05), 0.2),
  },
  {
    id: 'zh:t2', label: 'á', name: 'Tone 2 · rising', example: '麻 má', category: 'tone', contour: [3, 3, 3.5, 4.2, 5],
    pose: pose({ open: 0.45, spread: 0.3 }),
    tip: {
      little: 'Make your voice go up, like asking “Huh?”',
      junior: 'Start in the middle and slide up — like asking a surprised question: “What?”',
      teen: 'Rise from mid to high (35). Start the rise early enough that it reaches the top.',
    },
    steps: ['Start in the middle', 'Slide up', 'Finish high'],
    problem: 'Tone 2 should rise all the way up.',
    detail: 'Second tone, Chao 35: a clear rise. It is easily confused with the 3rd tone, which also rises in isolation but starts much lower.',
    difficulty: 0.55, l1: l1(yue(0.12), 0.25),
  },
  {
    id: 'zh:t3', label: 'ǎ', name: 'Tone 3 · low dip', example: '马 mǎ', category: 'tone', contour: [2.5, 1.6, 1.2, 1.6, 3.5],
    pose: pose({ open: 0.45, spread: 0.3 }),
    tip: {
      little: 'Go down low, then come up a little — like a sleepy “ohhh”.',
      junior: 'Drop your voice to the bottom, then let it come up a little at the end. If more words follow, just stay low.',
      teen: 'Dip to the bottom of your range (214). Before other syllables keep it low (21); before another 3rd tone it becomes a 2nd.',
    },
    steps: ['Start a bit low', 'Go to the very bottom', 'Come up a little at the end'],
    problem: 'Tone 3 needs to go really low.',
    detail: 'Third tone, Chao 214 in isolation, 21 when followed by other syllables, and 35 (like tone 2) before another 3rd tone: 你好 = ní hǎo.',
    difficulty: 0.65, l1: l1(yue(0.15), 0.3),
  },
  {
    id: 'zh:t4', label: 'à', name: 'Tone 4 · falling', example: '大 dà', category: 'tone', contour: [5, 4.4, 3.5, 2.4, 1.2],
    pose: pose({ open: 0.45, spread: 0.3 }),
    tip: {
      little: 'Say it sharp and fall down — like “No!” when you really mean it.',
      junior: 'Start high and drop fast to the bottom, like saying “No!” firmly.',
      teen: 'Fall sharply from the top of your range to the bottom (51) — all the way down.',
    },
    steps: ['Start high', 'Drop fast', 'Land at the bottom'],
    problem: 'Tone 4 should fall from high all the way down.',
    detail: 'Fourth tone, Chao 51: a full, quick fall. Learners often fall only halfway, which can sound like a 1st tone.',
    difficulty: 0.45, l1: l1(yue(0.05), 0.2),
  },
  {
    id: 'zh:sh', label: 'zh ch sh', name: 'Curled-tongue sounds', example: '是 shì', category: 'consonant',
    pose: pose({ open: 0.25, round: 0.35, tongue: 'curled-back', air: 'stream', voiced: false }),
    tip: {
      little: 'Curl your tongue up and back — then say “sh”, like a hushing kitten.',
      junior: 'Lift the tip of your tongue up and back, behind the bumpy ridge. zh, ch and sh are “hushier” than z, c and s.',
      teen: 'Retroflex: curl the tongue tip up behind the alveolar ridge. Keep 是 shì clearly different from 四 sì.',
    },
    steps: ['Tongue tip up', 'Curl it back a little', 'Push the air out'],
    problem: 'Curl your tongue back — it sounded like the flat “s”.',
    detail: 'zh, ch, sh and r are retroflex. Cantonese has no retroflex sounds, so they easily become z, c, s (是 → 四, 知 → 资).',
    difficulty: 0.6, l1: l1(yue(0.25, 'zh:flat'), 0.1),
  },
  {
    id: 'zh:s', label: 'z c s', name: 'Flat-tongue sounds', example: '四 sì', category: 'consonant',
    pose: pose({ open: 0.15, spread: 0.45, tongue: 'ridge', air: 'stream', voiced: false }),
    tip: {
      little: 'Keep your tongue flat behind your teeth and hiss like a snake: “sss” — no curling!',
      junior: 'Keep your tongue tip flat, just behind your top teeth, and hiss. Don’t curl it back — that turns s into sh.',
      teen: 'Dental z/c/s: tongue tip flat behind the upper teeth. Curling it back makes the retroflex zh/ch/sh (四 sì → 是 shì).',
    },
    steps: ['Tongue tip flat behind your teeth', 'Teeth nearly together', 'Hiss — no curling'],
    problem: 'Keep your tongue flat — it curled back into “sh”.',
    detail: 'z, c, s are made with a flat tongue tip at the teeth. Learners who have just learned zh/ch/sh sometimes curl everything.',
    difficulty: 0.4, l1: l1(yue(0.05), 0.15),
  },
  {
    id: 'zh:j', label: 'j q x', name: 'Smiley j q x', example: '西 xī', category: 'consonant',
    pose: pose({ open: 0.2, spread: 0.75, tongue: 'behind-bottom', air: 'stream', voiced: false }),
    tip: {
      little: 'Smile wide and keep your tongue tip down behind your bottom teeth!',
      junior: 'Smile, tuck your tongue tip behind your bottom teeth and push the middle of your tongue up.',
      teen: 'Alveolo-palatal: tongue tip down behind the lower teeth, tongue body raised, lips spread.',
    },
    steps: ['Smile', 'Tongue tip behind your bottom teeth', 'Middle of your tongue up'],
    problem: 'For j, q and x, keep your tongue tip down and smile.',
    detail: 'j, q, x are made with the middle of the tongue. Cantonese speakers often use a z/c/s or a “j” as in “jeep” instead.',
    difficulty: 0.5, l1: l1(yue(0.15), 0.15),
  },
  {
    id: 'zh:ü', label: 'ü', name: 'Round ü', example: '鱼 yú', category: 'vowel',
    pose: pose({ open: 0.15, round: 1, tongue: 'high-front' }),
    tip: {
      little: 'Say “ee”, then make a tiny round kiss with your lips — keep your tongue still!',
      junior: 'Say “ee” and round your lips tightly without moving your tongue.',
      teen: 'High front rounded vowel: tongue as for “ee”, lips as for “oo”.',
    },
    steps: ['Say “ee”', 'Keep your tongue still', 'Round your lips'],
    problem: 'For ü, keep your tongue at “ee” but round your lips.',
    detail: 'ü (written u after j, q, x, y) is a rounded “ee”. It slips to “ee” (鱼 → 姨) or “oo” (绿 → 路).',
    difficulty: 0.5, l1: l1(yue(0.1), 0.25),
  },
  {
    id: 'zh:n', label: 'n / l', name: 'N and L', example: '你 nǐ', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'ridge', air: 'nose' }),
    tip: {
      little: 'For n, hum through your nose. For l, let the sound flow round your tongue!',
      junior: 'For n, the air goes through your nose — pinch it and the sound stops. For l, it flows round the sides of your tongue.',
      teen: 'n is nasal, l is lateral. Pinch your nose to check: n stops, l keeps going.',
    },
    steps: ['Tongue tip behind your top teeth', 'n: hum through your nose', 'l: let it flow over the sides'],
    problem: 'Keep n (through your nose) and l (round your tongue) apart.',
    detail: 'Many Hong Kong speakers merge n into l (你 nǐ → lǐ, 男 nán → lán).',
    difficulty: 0.5, l1: l1(yue(0.2, 'zh:l'), -0.1),
  },
  {
    // The label's hyphens are non-breaking, so a small tile wraps it as "‑n /" over "‑ng".
    id: 'zh:-ng', label: '‑n / ‑ng', name: 'Endings -n and -ng', example: '汤 tāng', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'high-back', air: 'nose' }),
    tip: {
      little: 'For -ng, finish with a hum at the back, like “sing”!',
      junior: 'For -ng, lift the back of your tongue and hum through your nose, like the end of “sing”. For -n, lift the tip instead.',
      teen: 'Velar -ng versus alveolar -n: end 汤 tāng with the back of the tongue, 贪 tān with the tip.',
    },
    steps: ['-n: tongue tip up', '-ng: back of your tongue up', 'Hum through your nose'],
    problem: 'Listen for the ending: -ng hums at the back, -n at the front.',
    detail: 'Mandarin keeps -n and -ng apart (山 shān / 伤 shāng, 金 jīn / 京 jīng).',
    difficulty: 0.4, l1: yue(0.1),
  },
];
