import type { Accent, AgeBand, HomeLanguage, Locale, PhonemeId } from '../domain/types';
import { EN } from './course';
import { language, tc } from '../i18n';
import { FR_SOUNDS } from './fr/sounds';
import { JA_SOUNDS } from './ja/sounds';
import { KO_SOUNDS } from './ko/sounds';
import { ES_SOUNDS } from './es/sounds';
import { YUE_SOUNDS } from './yue/sounds';
import { ZH_SOUNDS } from './zh/sounds';
import { inScript } from './zh/script';

/** Parameters for the mouth illustration. Numeric so poses can be tweened into animation later. */
export interface MouthPose {
  /** Jaw opening 0 (closed) – 1 (wide). */
  open: number;
  /** Lip rounding 0 – 1. */
  round: number;
  /** Lip spreading (smile) 0 – 1. */
  spread: number;
  tongue: 'rest' | 'between-teeth' | 'ridge' | 'curled-back' | 'low' | 'high-front' | 'high-back' | 'behind-bottom';
  teethOnLip?: boolean;
  air: 'none' | 'stream' | 'puff' | 'nose';
  voiced: boolean;
}

export interface PhonemeInfo {
  id: PhonemeId;
  /** How the sound is usually spelled — what a child recognises, e.g. "th". */
  label: string;
  /** Friendly name for cards and the Lab. */
  name: string;
  example: string;
  category: 'consonant' | 'vowel' | 'tone';
  pose: MouthPose;
  /** Tones: the pitch shape on Chao's 1 (low) – 5 (high) scale at five points, for the tone picture. */
  contour?: number[];
  /** Short, do-this-with-your-mouth instructions. `junior` is the base; others fall back to it. */
  tip: Partial<Record<AgeBand, string>> & { junior: string };
  /** Three bullet steps shown in the mouth guide. */
  steps: string[];
  /** What usually goes wrong when no substitution was detected. */
  problem: string;
  /** Optional expanded phonetic detail for curious / older learners. */
  detail: string;
  /** 0–1 baseline difficulty for a young EFL learner. */
  difficulty: number;
  /** Extra difficulty and the most likely substitution per home language. */
  l1?: Partial<Record<HomeLanguage, { boost: number; heardAs?: PhonemeId }>>;
  /** Fallback substitution when the home language gives no hint. */
  heardAs?: PhonemeId;
}

const pose = (p: Partial<MouthPose>): MouthPose => ({
  open: 0.3, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: true, ...p,
});

// The wording below is the English source. Other App languages translate it in src/i18n/<language>/content.json under
// `sound.<id>.…` (read by `phonemeInfo`, at the bottom) — when a line changes here, its translation needs another look.
const list: PhonemeInfo[] = [
  // ---------- The sounds children learning English struggle with most ----------
  {
    id: 'θ', label: 'th', name: 'Quiet TH', example: 'three', category: 'consonant',
    pose: pose({ open: 0.25, tongue: 'between-teeth', air: 'stream', voiced: false }),
    tip: {
      little: 'Peek your tongue out between your teeth and blow softly — like a quiet snake!',
      junior: 'Put the tip of your tongue lightly between your teeth and blow air over it.',
      teen: 'Rest your tongue tip lightly between your teeth and push air forward. No voice.',
    },
    steps: ['Tongue tip lightly between your teeth', 'Blow air forward', 'Keep your voice off'],
    problem: 'The “th” needs your tongue between your teeth.',
    detail: 'Voiceless dental fricative /θ/. The air hisses between tongue tip and upper teeth; the vocal folds do not vibrate. Many languages lack it, so learners swap in /s/, /t/ or /f/.',
    difficulty: 0.78, heardAs: 's',
    l1: { fr: { boost: 0.08, heardAs: 's' }, de: { boost: 0.08, heardAs: 's' }, zh: { boost: 0.1, heardAs: 's' }, ja: { boost: 0.1, heardAs: 's' }, ko: { boost: 0.08, heardAs: 's' }, pt: { boost: 0.06, heardAs: 't' }, es: { boost: 0.02, heardAs: 't' } },
  },
  {
    id: 'ð', label: 'th', name: 'Buzzy TH', example: 'this', category: 'consonant',
    pose: pose({ open: 0.25, tongue: 'between-teeth', air: 'stream', voiced: true }),
    tip: {
      little: 'Tongue between your teeth, then buzz like a bee: “thhh”.',
      junior: 'Tongue between your teeth again — this time switch your voice on so it buzzes.',
      teen: 'Same tongue position as quiet TH, but add your voice. You should feel a buzz on your tongue.',
    },
    steps: ['Tongue tip lightly between your teeth', 'Turn your voice on', 'Feel the tickly buzz'],
    problem: 'The “th” here should buzz, with your tongue between your teeth.',
    detail: 'Voiced dental fricative /ð/, as in “this, mother”. Common substitutions are /d/ and /z/.',
    difficulty: 0.72, heardAs: 'd',
    l1: { fr: { boost: 0.08, heardAs: 'z' }, de: { boost: 0.08, heardAs: 'z' }, zh: { boost: 0.1, heardAs: 'd' }, ja: { boost: 0.1, heardAs: 'z' }, ko: { boost: 0.08, heardAs: 'd' }, pt: { boost: 0.06, heardAs: 'd' }, es: { boost: 0.04, heardAs: 'd' } },
  },
  {
    id: 'r', label: 'r', name: 'English R', example: 'red', category: 'consonant',
    pose: pose({ open: 0.3, round: 0.55, tongue: 'curled-back', voiced: true }),
    tip: {
      little: 'Make your lips a little round and growl like a friendly tiger: “rrr”. Your tongue hides — it touches nothing!',
      junior: 'Round your lips a little and pull your tongue back. Don’t let it touch the top of your mouth.',
      teen: 'Pull your tongue slightly back without touching the roof of your mouth, lips lightly rounded.',
    },
    steps: ['Lips a little round', 'Pull your tongue back', 'Tongue touches nothing'],
    problem: 'Your tongue tapped the top of your mouth — English R doesn’t touch.',
    detail: 'Alveolar approximant /ɹ/. Unlike the tapped or trilled R of many languages, the tongue never makes contact; the tip bunches or curls back while the lips round slightly.',
    difficulty: 0.7, heardAs: 'l',
    l1: { ja: { boost: 0.15, heardAs: 'l' }, ko: { boost: 0.13, heardAs: 'l' }, zh: { boost: 0.1, heardAs: 'l' }, es: { boost: 0.06, heardAs: 'ɾ' }, pt: { boost: 0.06, heardAs: 'h' }, fr: { boost: 0.1, heardAs: 'ʁ' }, de: { boost: 0.1, heardAs: 'ʁ' } },
  },
  {
    id: 'l', label: 'l', name: 'Light L', example: 'like', category: 'consonant',
    pose: pose({ open: 0.35, tongue: 'ridge', voiced: true }),
    tip: {
      little: 'Tap the bumpy spot behind your top teeth with your tongue: “la la la”.',
      junior: 'Press your tongue tip on the bump just behind your top teeth and let your voice flow around it.',
    },
    steps: ['Tongue tip behind your top teeth', 'Keep it pressed there', 'Let your voice flow round the sides'],
    problem: 'For L, your tongue tip must touch just behind your top teeth.',
    detail: 'Alveolar lateral approximant /l/. Air flows around the sides of the tongue while the tip stays on the alveolar ridge.',
    difficulty: 0.42, heardAs: 'r',
    l1: { ja: { boost: 0.3, heardAs: 'r' }, ko: { boost: 0.25, heardAs: 'r' }, zh: { boost: 0.1, heardAs: 'n' } },
  },
  {
    id: 'v', label: 'v', name: 'Buzzy V', example: 'very', category: 'consonant',
    pose: pose({ open: 0.2, tongue: 'rest', teethOnLip: true, air: 'stream', voiced: true }),
    tip: {
      little: 'Bite your bottom lip gently like a bunny and buzz: “vvv”.',
      junior: 'Rest your top teeth on your bottom lip and buzz. Your lips must not close.',
      teen: 'Top teeth on bottom lip, voice on. If your lips round or close, it turns into W or B.',
    },
    steps: ['Top teeth on your bottom lip', 'Turn your voice on', 'Feel your lip tickle'],
    problem: 'V needs your top teeth resting on your bottom lip.',
    detail: 'Voiced labiodental fricative /v/. Substituting /w/ (German, Hindi), /b/ (Spanish, Korean, Japanese) or /f/ is common.',
    difficulty: 0.55, heardAs: 'w',
    l1: { de: { boost: 0.12, heardAs: 'w' }, es: { boost: 0.18, heardAs: 'b' }, ko: { boost: 0.15, heardAs: 'b' }, ja: { boost: 0.15, heardAs: 'b' }, zh: { boost: 0.12, heardAs: 'w' } },
  },
  {
    id: 'w', label: 'w', name: 'Round W', example: 'water', category: 'consonant',
    pose: pose({ open: 0.15, round: 1, tongue: 'high-back', voiced: true }),
    tip: {
      little: 'Make a tiny kiss shape, then open: “wuh”. No teeth!',
      junior: 'Start with small round lips like blowing a candle, then open quickly. Teeth stay away from your lip.',
    },
    steps: ['Small round lips', 'No teeth on your lip', 'Open quickly into the next sound'],
    problem: 'W starts with small round lips — your teeth touched your lip, so it sounded like V.',
    detail: 'Labio-velar approximant /w/. Lips round tightly and release into the following vowel; there is no lip–teeth contact.',
    difficulty: 0.4, heardAs: 'v',
    l1: { de: { boost: 0.25, heardAs: 'v' }, fr: { boost: 0.05, heardAs: 'v' } },
  },
  {
    id: 'æ', label: 'a', name: 'Wide A', example: 'apple', category: 'vowel',
    pose: pose({ open: 0.85, spread: 0.6, tongue: 'low', voiced: true }),
    tip: {
      little: 'Open your mouth big and smile, like biting a huge apple: “aaa”.',
      junior: 'Drop your jaw and spread your lips wide — a big open smile.',
      teen: 'Open your mouth more and spread your lips. It sits between “e” in bed and “a” in father.',
    },
    steps: ['Open your mouth wide', 'Spread your lips in a smile', 'Tongue low and forward'],
    problem: 'The “a” sound needs a wider, more open mouth.',
    detail: 'Near-open front unrounded vowel /æ/. Learners often raise it towards /ɛ/ (“bed”) or back it towards /ɑ/.',
    difficulty: 0.55, heardAs: 'ɛ',
    l1: { es: { boost: 0.1, heardAs: 'ɑ' }, de: { boost: 0.12, heardAs: 'ɛ' }, fr: { boost: 0.1, heardAs: 'ɑ' }, zh: { boost: 0.1, heardAs: 'ɛ' }, ko: { boost: 0.12, heardAs: 'ɛ' }, ja: { boost: 0.1, heardAs: 'ɑ' }, pt: { boost: 0.08, heardAs: 'ɛ' } },
  },
  {
    id: 'ɪ', label: 'i', name: 'Short I', example: 'milk', category: 'vowel',
    pose: pose({ open: 0.3, spread: 0.35, tongue: 'high-front', voiced: true }),
    tip: {
      little: 'Make it quick and relaxed: “ih”. Not a long “eee”!',
      junior: 'Keep it short and relaxed — “ih”, not “ee”. Don’t smile too wide.',
      teen: 'Relax your lips and keep the vowel short. If you smile and hold it, it becomes “ee”.',
    },
    steps: ['Relax your lips', 'Keep it short', 'Don’t stretch into “ee”'],
    problem: 'This vowel was too long — it sounded like “ee”.',
    detail: 'Near-close front lax vowel /ɪ/ (“ship”) versus tense /iː/ (“sheep”). Many languages have only one of the pair.',
    difficulty: 0.5, heardAs: 'i',
    l1: { es: { boost: 0.18, heardAs: 'i' }, fr: { boost: 0.15, heardAs: 'i' }, pt: { boost: 0.15, heardAs: 'i' }, ja: { boost: 0.1, heardAs: 'i' }, ko: { boost: 0.1, heardAs: 'i' }, zh: { boost: 0.1, heardAs: 'i' } },
  },
  {
    id: 'ʃ', label: 'sh', name: 'Quiet SH', example: 'fish', category: 'consonant',
    pose: pose({ open: 0.2, round: 0.7, tongue: 'ridge', air: 'stream', voiced: false }),
    tip: {
      little: 'Push your lips out and say “shhh”, like the baby is sleeping.',
      junior: 'Push your lips forward and let the air rush out: “shhh”.',
    },
    steps: ['Push your lips forward', 'Tongue close to the top, not touching', 'Let the air rush out'],
    problem: 'SH needs rounded lips pushed forward — it sounded like “s”.',
    detail: 'Voiceless postalveolar fricative /ʃ/. Flatter and further back than /s/, with lip rounding.',
    difficulty: 0.35, heardAs: 's',
    l1: { es: { boost: 0.2, heardAs: 'tʃ' }, ko: { boost: 0.1, heardAs: 's' } },
  },
  {
    id: 'tʃ', label: 'ch', name: 'CH', example: 'cheese', category: 'consonant',
    pose: pose({ open: 0.2, round: 0.6, tongue: 'ridge', air: 'puff', voiced: false }),
    tip: {
      little: 'Like a little train: “ch-ch-ch”!',
      junior: 'Start with your tongue on the bump behind your teeth, then let go with a burst: “ch”.',
    },
    steps: ['Tongue tip on the bump behind your top teeth', 'Lips pushed forward', 'Let go with a quick burst'],
    problem: 'CH starts with a stop — it sounded like “sh”.',
    detail: 'Voiceless postalveolar affricate /tʃ/: a /t/-like closure released into /ʃ/.',
    difficulty: 0.32, heardAs: 'ʃ',
    l1: { fr: { boost: 0.15, heardAs: 'ʃ' }, pt: { boost: 0.12, heardAs: 'ʃ' } },
  },
  {
    id: 'dʒ', label: 'j', name: 'J', example: 'juice', category: 'consonant',
    pose: pose({ open: 0.2, round: 0.6, tongue: 'ridge', air: 'puff', voiced: true }),
    tip: { junior: 'Like “ch” but with your voice on: “j”. Start with your tongue on the bump behind your teeth.' },
    steps: ['Tongue tip behind your top teeth', 'Voice on', 'Release with a burst'],
    problem: 'J needs a firm start with your voice on.',
    detail: 'Voiced postalveolar affricate /dʒ/. Often softened to /ʒ/ (French, Portuguese) or /j/ (Spanish, German).',
    difficulty: 0.38, heardAs: 'ʒ',
    l1: { fr: { boost: 0.15, heardAs: 'ʒ' }, pt: { boost: 0.12, heardAs: 'ʒ' }, es: { boost: 0.15, heardAs: 'j' }, de: { boost: 0.1, heardAs: 'tʃ' } },
  },
  {
    id: 'h', label: 'h', name: 'Breathy H', example: 'hot', category: 'consonant',
    pose: pose({ open: 0.5, tongue: 'rest', air: 'puff', voiced: false }),
    tip: {
      little: 'Breathe out like you’re fogging up a window: “hhh”.',
      junior: 'Just breathe out gently before the vowel — like fogging up a mirror.',
    },
    steps: ['Mouth open', 'Breathe out softly', 'Go straight into the next sound'],
    problem: 'The H was missing — start the word with a soft breath.',
    detail: 'Voiceless glottal fricative /h/. Silent in French, Spanish, Portuguese and Italian spelling, so it is often dropped.',
    difficulty: 0.25, heardAs: '∅',
    l1: { fr: { boost: 0.3, heardAs: '∅' }, es: { boost: 0.15, heardAs: 'x' }, pt: { boost: 0.2, heardAs: '∅' } },
  },
  {
    id: 'ŋ', label: 'ng', name: 'NG', example: 'sing', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'high-back', air: 'nose', voiced: true }),
    tip: { junior: 'Hum through your nose with the back of your tongue up. Don’t add a “g” at the end.' },
    steps: ['Back of your tongue up', 'Hum through your nose', 'No hard “g” at the end'],
    problem: 'The “ng” should hum through your nose without a hard “g”.',
    detail: 'Velar nasal /ŋ/. Learners often add a /g/ or /k/ release, or use /n/.',
    difficulty: 0.32, heardAs: 'n',
  },
  {
    id: 'z', label: 'z', name: 'Buzzy Z', example: 'please', category: 'consonant',
    pose: pose({ open: 0.15, spread: 0.4, tongue: 'ridge', air: 'stream', voiced: true }),
    tip: {
      little: 'Buzz like a bee: “zzz”!',
      junior: 'Say “sss”, then switch your voice on so it buzzes: “zzz”.',
    },
    steps: ['Teeth nearly closed', 'Say “sss”', 'Turn your voice on to buzz'],
    problem: 'The end should buzz like “z”, not hiss like “s”.',
    detail: 'Voiced alveolar fricative /z/. Often devoiced to /s/, especially word-finally (“please”, “is”).',
    difficulty: 0.36, heardAs: 's',
    l1: { es: { boost: 0.2, heardAs: 's' }, de: { boost: 0.1, heardAs: 's' }, zh: { boost: 0.1, heardAs: 's' }, ko: { boost: 0.12, heardAs: 's' } },
  },
  {
    id: 'ɚ', label: 'er', name: 'Ending ER', example: 'water', category: 'vowel',
    pose: pose({ open: 0.3, round: 0.4, tongue: 'curled-back', voiced: true }),
    tip: {
      little: 'Finish with a little tiger growl: “errr”. Your tongue pulls back and touches nothing.',
      junior: 'Finish the word with a soft growl — “errr”. Pull your tongue back; don’t let it touch anything.',
      teen: 'End with an R-sound, not “uh”: pull your tongue back, lips slightly rounded, tongue touching nothing.',
    },
    steps: ['Say a lazy “uh”', 'Pull your tongue back', 'Hold the growl: “errr”'],
    problem: 'The ending should growl like “er”, not stop at “uh”.',
    detail: 'R-coloured schwa /ɚ/ (American English). In British English this ending is a plain /ə/, so it is only taught for the American target.',
    difficulty: 0.45, heardAs: 'ə',
  },
  {
    id: 'ɝ', label: 'ur', name: 'Strong UR', example: 'thirsty', category: 'vowel',
    pose: pose({ open: 0.3, round: 0.45, tongue: 'curled-back', voiced: true }),
    tip: {
      little: 'Growl like a tiny tiger: “errr”. Lips a little round, tongue pulled back.',
      junior: 'Make one long growly sound — “errr”. Round your lips a little and pull your tongue back.',
      teen: 'One steady R-coloured vowel: lips slightly rounded, tongue pulled back and touching nothing.',
    },
    steps: ['Lips a little round', 'Pull your tongue back', 'One long growl: “errr”'],
    problem: 'This “ur” needs your tongue pulled back the whole time.',
    detail: 'Stressed R-coloured vowel /ɝ/ as in “bird, turn”. Learners often split it into a vowel plus a tapped R, or use /ɑ/ or /ɛ/.',
    difficulty: 0.5, heardAs: 'ɛ',
    l1: { es: { boost: 0.1, heardAs: 'ɛ' }, ja: { boost: 0.12, heardAs: 'ɑ' }, ko: { boost: 0.1, heardAs: 'ʌ' }, zh: { boost: 0.05, heardAs: 'ɚ' } },
  },
];

// ---------- Everything else: easier sounds still get specific, physical tips ----------

type Easy = [id: string, label: string, example: string, tip: string, problem: string, difficulty: number, p: Partial<MouthPose>, heardAs?: string];

const easyConsonants: Easy[] = [
  ['p', 'p', 'pen', 'Close your lips, then pop them open with a puff of air.', 'P needs a little puff of air when your lips open.', 0.12, { open: 0.05, air: 'puff', voiced: false }, 'b'],
  ['b', 'b', 'bread', 'Close your lips and pop them open with your voice on.', 'B needs your lips fully closed first.', 0.12, { open: 0.05, air: 'puff' }, 'p'],
  ['t', 't', 'ten', 'Tap your tongue tip behind your top teeth and let go with a puff.', 'T needs a crisp tap behind your top teeth.', 0.14, { tongue: 'ridge', air: 'puff', voiced: false }, 'd'],
  ['d', 'd', 'drink', 'Tap your tongue tip behind your top teeth with your voice on.', 'D needs a clear tap behind your top teeth.', 0.14, { tongue: 'ridge', air: 'puff' }, 't'],
  ['k', 'k', 'cup', 'Lift the back of your tongue, then let go with a puff: “k”.', 'The K sound was too soft — finish it with a clear puff.', 0.16, { open: 0.35, tongue: 'high-back', air: 'puff', voiced: false }, 'g'],
  ['g', 'g', 'good', 'Lift the back of your tongue and let go with your voice on.', 'G needs the back of your tongue to lift and release.', 0.14, { open: 0.35, tongue: 'high-back', air: 'puff' }, 'k'],
  ['f', 'f', 'food', 'Rest your top teeth on your bottom lip and blow.', 'F needs your top teeth on your bottom lip.', 0.16, { open: 0.2, teethOnLip: true, air: 'stream', voiced: false }, 'p'],
  ['s', 's', 'soup', 'Teeth almost closed, tongue behind them, and hiss: “sss”.', 'The S should be a clean hiss.', 0.16, { open: 0.12, spread: 0.4, tongue: 'ridge', air: 'stream', voiced: false }, 'ʃ'],
  ['ʒ', 'zh', 'usually', 'Say “sh” and switch your voice on.', 'This sound is “sh” with your voice on.', 0.3, { open: 0.2, round: 0.7, tongue: 'ridge', air: 'stream' }, 'ʃ'],
  ['m', 'm', 'milk', 'Close your lips and hum: “mmm”.', 'M needs closed lips and a hum.', 0.06, { open: 0, air: 'nose' }],
  ['n', 'n', 'no', 'Tongue tip behind your top teeth and hum through your nose.', 'N needs your tongue tip up behind your top teeth.', 0.08, { tongue: 'ridge', air: 'nose' }],
  ['j', 'y', 'yes', 'Start with a quick “ee” and slide into the next sound.', 'The Y sound should glide quickly into the vowel.', 0.14, { spread: 0.5, tongue: 'high-front' }, 'dʒ'],
];

const vowels: Easy[] = [
  ['i', 'ee', 'cheese', 'Smile wide and hold it: “eee”.', 'This “ee” should be long with a wide smile.', 0.2, { open: 0.15, spread: 0.9, tongue: 'high-front' }, 'ɪ'],
  ['ɛ', 'e', 'bread', 'Open your mouth a little and relax: “eh”.', 'The “e” needs a slightly more open mouth.', 0.22, { open: 0.45, spread: 0.4, tongue: 'high-front' }, 'eɪ'],
  ['ɑ', 'ah', 'car', 'Open wide like at the doctor’s: “ah”.', 'Open your mouth wider for this “ah” sound.', 0.24, { open: 0.9, tongue: 'low' }, 'ʌ'],
  // British vowels (Standard Southern British): short rounded "o", and the "oh" that starts from "uh".
  ['ɒ', 'o', 'hot', 'Drop your jaw and round your lips a little — a short, quick “o”.', 'This short “o” needs slightly rounded lips — it sounded too flat.', 0.3, { open: 0.75, round: 0.45, tongue: 'low' }, 'ɑ'],
  ['əʊ', 'oh', 'no', 'Start with a relaxed “uh” and glide to a small round “oo”: “uh-oo”.', 'This “oh” should glide from “uh” to round lips.', 0.28, { open: 0.4, round: 0.7, tongue: 'rest' }, 'ɔ'],
  ['ɪə', 'ear', 'here', 'Start at a short “ih” and relax into “uh”: “ih-uh”. No R at the end.', 'This sound glides “ih-uh” — don’t add an R.', 0.3, { open: 0.3, spread: 0.3, tongue: 'high-front' }, 'i'],
  ['eə', 'air', 'there', 'Start at “eh” and relax into “uh”: “eh-uh”. No R at the end.', 'This sound glides “eh-uh” — don’t add an R.', 0.3, { open: 0.45, spread: 0.3, tongue: 'high-front' }, 'ɛ'],
  ['ɔ', 'aw', 'water', 'Round your lips and drop your jaw: “aw”.', 'Round your lips more for this “aw” sound.', 0.28, { open: 0.65, round: 0.6, tongue: 'high-back' }, 'oʊ'],
  ['ʊ', 'oo', 'good', 'Short and relaxed with soft round lips: “uh-oo”. Don’t hold it.', 'This vowel was too long — keep “oo” short and relaxed.', 0.42, { open: 0.3, round: 0.6, tongue: 'high-back' }, 'u'],
  ['u', 'oo', 'juice', 'Make tight round lips and hold: “ooo”.', 'Round your lips tightly and hold this “oo”.', 0.2, { open: 0.15, round: 1, tongue: 'high-back' }, 'ʊ'],
  ['ʌ', 'u', 'cup', 'Relax everything and say a short “uh”.', 'This “uh” should be short and relaxed — your mouth was too open.', 0.38, { open: 0.45, tongue: 'rest' }, 'ɑ'],
  ['ə', 'uh', 'banana', 'A tiny, lazy “uh” — say it quickly and quietly.', 'This little sound should be quick and quiet, not a full vowel.', 0.3, { open: 0.3, tongue: 'rest' }, 'ɑ'],
  ['ɜ', 'ur', 'thirsty', 'One long relaxed sound: “uhh”. Keep your lips relaxed and don’t add an R.', 'This “ur” should be one long, relaxed vowel.', 0.4, { open: 0.35, tongue: 'rest' }, 'ɛ'],
  ['eɪ', 'ay', 'plate', 'Start at “eh” and slide up to “ee”: “ay”.', 'This sound slides: “eh” → “ee”. Yours stayed in one place.', 0.22, { open: 0.4, spread: 0.6, tongue: 'high-front' }, 'ɛ'],
  ['aɪ', 'i', 'like', 'Start wide open at “ah” and slide to “ee”.', 'This sound slides from “ah” to “ee”.', 0.18, { open: 0.75, spread: 0.4, tongue: 'low' }, 'ɑ'],
  ['ɔɪ', 'oy', 'enjoy', 'Start round at “aw” and slide to “ee”.', 'This sound slides from “aw” to “ee”.', 0.2, { open: 0.55, round: 0.6, tongue: 'high-back' }],
  ['aʊ', 'ow', 'brown', 'Start wide at “ah” and close to round lips: “ow”.', 'Finish this sound with round lips: “ah-oo”.', 0.22, { open: 0.75, round: 0.3, tongue: 'low' }, 'ɑ'],
  ['oʊ', 'oh', 'no', 'Start at “oh” and close your lips into a small circle.', 'This “oh” should finish with small round lips.', 0.26, { open: 0.45, round: 0.8, tongue: 'high-back' }, 'ɔ'],
];

const fromEasy = (category: 'consonant' | 'vowel') => (e: Easy): PhonemeInfo => {
  const [id, label, example, tip, problem, difficulty, p, heardAs] = e;
  return {
    id, label, example, category, difficulty, heardAs, problem,
    name: category === 'vowel' ? `“${label}” as in ${example}` : label.toUpperCase(),
    pose: pose(p),
    tip: { junior: tip },
    steps: tip.split(/(?:, and |, then | and |: )/).slice(0, 3).map((s) => s.replace(/[.“”]/g, '').trim()).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)),
    detail: `/${id}/ as in “${example}”.`,
  };
};

// Hong Kong Cantonese speakers: the usual trouble spots in English, and what tends to come out instead.
const CANTONESE: Record<PhonemeId, { boost: number; heardAs?: PhonemeId }> = {
  'θ': { boost: 0.12, heardAs: 'f' }, 'ð': { boost: 0.12, heardAs: 'd' }, v: { boost: 0.2, heardAs: 'w' }, r: { boost: 0.14, heardAs: 'w' },
  n: { boost: 0.3, heardAs: 'l' }, l: { boost: 0.14, heardAs: 'n' }, z: { boost: 0.22, heardAs: 's' }, 'ʃ': { boost: 0.18, heardAs: 's' },
  'ʒ': { boost: 0.15, heardAs: 'ʃ' }, 'æ': { boost: 0.12, heardAs: 'ɛ' }, 'ɪ': { boost: 0.12, heardAs: 'i' }, 'ʊ': { boost: 0.08, heardAs: 'u' },
  t: { boost: 0.14, heardAs: '∅' }, d: { boost: 0.16, heardAs: '∅' }, k: { boost: 0.12, heardAs: '∅' }, p: { boost: 0.08, heardAs: '∅' },
  's': { boost: 0.06, heardAs: '∅' }, 'dʒ': { boost: 0.08, heardAs: 'tʃ' }, 'eɪ': { boost: 0.06, heardAs: 'ɛ' },
};

export const PHONEMES: Record<PhonemeId, PhonemeInfo> = Object.fromEntries([
  ...[...list, ...easyConsonants.map(fromEasy('consonant')), ...vowels.map(fromEasy('vowel'))]
    .map((p) => [p.id, CANTONESE[p.id] ? { ...p, l1: { ...p.l1, yue: CANTONESE[p.id] } } : p] as const),
  ...YUE_SOUNDS.map((p) => [p.id, p] as const),
  ...ZH_SOUNDS.map((p) => [p.id, p] as const),
  // French ids are plain IPA and none of them is an English one, so no namespace is needed (see fr/sounds.ts).
  ...FR_SOUNDS.map((p) => [p.id, p] as const),
  // Japanese beats and sound classes are namespaced "ja:…" like the Mandarin units (see ja/sounds.ts).
  ...JA_SOUNDS.map((p) => [p.id, p] as const),
  // Korean block classes "ko:…" and Spanish sounds "es:…" (namespaced: r, θ, ɲ would collide with English and French ids).
  ...KO_SOUNDS.map((p) => [p.id, p] as const),
  ...ES_SOUNDS.map((p) => [p.id, p] as const),
]);

/** Mandarin units are namespaced "zh:…", so the two catalogues never collide. */
export const isZhSound = (id: PhonemeId): boolean => id.startsWith('zh:');
export const isJaSound = (id: PhonemeId): boolean => id.startsWith('ja:');
export const isKoSound = (id: PhonemeId): boolean => id.startsWith('ko:');
export const isEsSound = (id: PhonemeId): boolean => id.startsWith('es:');
const FR_IDS = new Set<PhonemeId>(FR_SOUNDS.map((p) => p.id));

/** The language a sound's example is spoken in: a French or Japanese sound's example is a French or Japanese word. */
export const soundLocale = (id: PhonemeId, accent: Accent): Locale =>
  id.startsWith('yue:') ? 'zh-HK' : isZhSound(id) ? 'zh-CN' : isJaSound(id) ? 'ja-JP' : isKoSound(id) ? 'ko-KR' : isEsSound(id) ? 'es-ES' : FR_IDS.has(id) ? 'fr-FR' : accent;

/**
 * A sound's guide as the learner reads it — a copy, worked out when asked for, so it follows the App language and the
 * learner's script while the app is open:
 *   * name, tips, steps, problem and detail in the App language. The English is the data above; a translation is
 *     looked up by the sound's id (src/i18n/zh-Hant/content.json: `sound.θ.name`, `sound.θ.tip.junior`,
 *     `sound.θ.step.1`, `sound.θ.problem`, `sound.θ.detail`; a sound we have no guide for reads `sound.unknown.…`).
 *     The label and the example are what is being learned, so they are never translated.
 *   * for Mandarin sounds, the characters quoted in that wording in the learner's script (Traditional for most of
 *     Hong Kong). A translation quotes them as the data does — in Simplified, like the scorer — so the English and
 *     the translation go through the same conversion.
 */
export const phonemeInfo = (id: PhonemeId): PhonemeInfo => {
  const known = PHONEMES[id];
  const info: PhonemeInfo = known ?? {
    id, label: id, name: id, example: '', category: 'consonant', pose: pose({}),
    tip: { junior: 'Listen closely and copy the sound.' }, steps: ['Listen', 'Watch the mouth', 'Copy'],
    problem: 'This sound wasn’t quite clear.', detail: `/${id}/`, difficulty: 0.2,
  };
  const key = known ? `sound.${id}` : 'sound.unknown';
  const shown = (text: string): string => (isZhSound(id) ? inScript(text) : text);
  const say = (field: string, english: string): string => {
    const translated = tc(`${key}.${field}`, english);
    return language() === 'en' ? shown(translated) : translated;
  };
  return {
    ...info, name: say('name', info.name), example: shown(info.example), problem: say('problem', info.problem), detail: say('detail', info.detail),
    steps: info.steps.map((x, i) => say(`step.${i + 1}`, x)),
    tip: Object.fromEntries(Object.entries(info.tip).map(([band, x]) => [band, say(`tip.${band}`, x)])) as PhonemeInfo['tip'],
  };
};

/** The tip for this learner's age, in the App language (it reads `phonemeInfo`). */
export const tipFor = (id: PhonemeId, band: AgeBand): string => {
  const info = phonemeInfo(id);
  // Grown-ups get the teen wording (the most precise), never the little-ones version.
  return info.tip[band] ?? (band === 'adult' ? info.tip.teen : undefined) ?? info.tip.junior;
};

/** The example to say aloud. Mandarin examples read "妈 mā": say just the character, as the scorer writes it. */
export const exampleSpeech = (id: PhonemeId): string => {
  const ex = (PHONEMES[id] ?? phonemeInfo(id)).example;
  return /\p{Script=Han}/u.test(ex) ? ex.replace(/\s+\S+$/u, '') : ex;
};

/** Labels too long for a square glyph tile at full size ("zh ch sh", "-n / -ng"). */
export const isLongLabel = (label: string): boolean => label.replace(/\s/g, '').length > 3;

/**
 * How to write a (possibly foreign) sound for a child: English spelling if we know it, else the symbol. A spelling is
 * never translated; the few descriptions are (`sound.∅.label`, `sound.ɾ.label`, … in content.json).
 */
export const soundLabel = (id: PhonemeId): string => {
  if (id === '∅') return tc('sound.∅.label', 'nothing');
  const foreign: Record<string, string> = { 'ɾ': 'a tapped r', 'ʁ': 'a throaty r', 'x': 'a throaty h' };
  return foreign[id] ? tc(`sound.${id}.label`, foreign[id]) : PHONEMES[id]?.label ?? id;
};

/** Sounds with a full Pronunciation Lab ladder, in default teaching order. */
/** The Lab's English sounds, in teaching order — from the course data (content/courses/en.json, `lab.sounds`). */
export const LAB_SOUNDS: PhonemeId[] = EN.labSounds;
