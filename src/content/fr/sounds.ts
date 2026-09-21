import type { HomeLanguage, PhonemeId } from '../../domain/types';
import type { MouthPose, PhonemeInfo } from '../phonemes';

// The French sounds worth teaching: the ones an English or Cantonese speaker gets wrong, not the ones a textbook
// lists first. Same shape as the English and Mandarin catalogues, so the Lab, the drills and progress work unchanged.
//
// Why these nine. French has around 36 phonemes and most of them are near enough to English to arrive for free.
// What does not arrive for free is the rounded front vowels (y, ø, œ — English has no vowel made with the tongue
// forward and the lips round), the three nasal vowels, the uvular R, and /ʒ/ and /ɲ/, which exist in English only
// in borrowed words or across syllable boundaries. Everything else is left out on purpose: a learner who is told
// about eight sounds fixes eight sounds.
//
// The ids are plain IPA, as the English catalogue's are, and none of them collides with an English one (the English
// list teaches θ ð r l v w h z dʒ tʃ ʃ ŋ æ ɪ ɚ ɝ). They are also exactly what the lexicon writes, which is what
// lets a scored-but-unnamed French phoneme be named at all — see lexicon.ts.
//
// The wording here is the English source. Other App languages translate it in src/i18n/<language>/content.json under
// `sound.<id>.…`, read by `phonemeInfo` in ../phonemes.

const pose = (p: Partial<MouthPose>): MouthPose => ({ open: 0.3, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: true, ...p });
/** Hong Kong's first language, and the English that every learner here already has. Both push French the same way. */
const l1 = (yueBoost: number, heardAs?: PhonemeId): Partial<Record<HomeLanguage, { boost: number; heardAs?: PhonemeId }>> =>
  ({ yue: { boost: yueBoost, heardAs }, zh: { boost: yueBoost, heardAs } });

export const FR_SOUNDS: PhonemeInfo[] = [
  {
    id: 'y', label: 'u', name: 'Pointed U', example: 'tu', category: 'vowel',
    // Tongue where /i/ lives, lips where /u/ lives. The whole difficulty in one pose.
    pose: pose({ open: 0.2, round: 0.85, spread: 0, tongue: 'high-front' }),
    tip: {
      little: 'Say “eee”, then push your lips into a tiny circle — keep saying “eee” inside!',
      junior: 'Say “ee”. Now round your lips like a whistle without moving your tongue. That is the French u.',
      teen: 'Close front rounded vowel: the tongue position of /i/ with the lip rounding of /u/. The tongue must not slide back.',
    },
    steps: ['Say “ee” and hold it', 'Round your lips tightly', 'Keep the tongue forward'],
    problem: 'The French u needs rounded lips with the tongue still forward.',
    detail: '/y/ as in tu, rue, sur. English has no such vowel, so it is usually replaced by /u/ (tout) — which is a different word.',
    difficulty: 0.85, heardAs: 'u', l1: l1(0.1, 'u'),
  },
  {
    id: 'ʁ', label: 'r', name: 'Throat R', example: 'rouge', category: 'consonant',
    pose: pose({ open: 0.35, tongue: 'high-back', air: 'stream' }),
    tip: {
      little: 'Make a soft gargle at the back of your throat — like a cat purring.',
      junior: 'The French r is made at the back, near where you say “k”. Let the air rasp there. The tongue tip stays down.',
      teen: 'Voiced uvular fricative: raise the back of the tongue towards the uvula and let the air buzz through. Never curl the tongue tip.',
    },
    steps: ['Tongue tip down', 'Raise the back of the tongue', 'Let the air rasp'],
    problem: 'The French r is made in the throat, not with the tip of the tongue.',
    detail: '/ʁ/ as in rouge, Paris, merci. English /r/ curls the tongue tip; Cantonese has no r at all and often gives /w/ or /h/.',
    difficulty: 0.8, heardAs: 'r', l1: l1(0.15, 'w'),
  },
  {
    id: 'ɑ̃', label: 'an / en', name: 'Nose AH', example: 'grand', category: 'vowel',
    pose: pose({ open: 0.7, round: 0.25, tongue: 'low', air: 'nose' }),
    tip: {
      little: 'Say “ahh” and let it buzz out of your nose. Don’t say the n!',
      junior: 'Open wide for “ahh” and send the sound through your nose. There is no n sound at the end — the nose does all the work.',
      teen: 'Open back nasal vowel. The velum lowers for the whole vowel; no /n/ or /ŋ/ is articulated after it.',
    },
    steps: ['Open wide', 'Let it buzz in your nose', 'No n at the end'],
    problem: 'A nasal vowel hums through the nose — and has no n after it.',
    detail: '/ɑ̃/ as in grand, dans, temps. English speakers add a consonant: "grahn-d". The nasality belongs to the vowel itself.',
    difficulty: 0.7, l1: l1(0.05),
  },
  {
    id: 'ɛ̃', label: 'in / ain', name: 'Nose EH', example: 'pain', category: 'vowel',
    pose: pose({ open: 0.5, spread: 0.35, tongue: 'low', air: 'nose' }),
    tip: {
      little: 'Say “eh” and let it buzz in your nose — like a little bell.',
      junior: 'Say “eh” with your mouth half open and hum it through your nose. No n at the end.',
      teen: 'Open-mid front nasal vowel. Keep the tongue forward — it is easily pulled back towards /ɑ̃/.',
    },
    steps: ['Say “eh”', 'Hum it through your nose', 'Keep the tongue forward'],
    problem: 'This nasal should stay at the front of the mouth.',
    detail: '/ɛ̃/ as in pain, vin, main. Confused with /ɑ̃/ (pain vs paon) when the tongue slides back.',
    difficulty: 0.75, heardAs: 'ɑ̃', l1: l1(0.05, 'ɑ̃'),
  },
  {
    id: 'ɔ̃', label: 'on', name: 'Nose OH', example: 'bon', category: 'vowel',
    pose: pose({ open: 0.4, round: 0.7, tongue: 'high-back', air: 'nose' }),
    tip: {
      little: 'Round your lips like an O and hum it out of your nose!',
      junior: 'Round your lips for “oh” and send it through your nose. Keep the lips round the whole time.',
      teen: 'Close-mid back rounded nasal. Rounder and higher than /ɑ̃/; losing the rounding turns bon into banc.',
    },
    steps: ['Round your lips', 'Say “oh”', 'Hum it through your nose'],
    problem: 'Keep the lips round and let it hum in the nose.',
    detail: '/ɔ̃/ as in bon, non, maison. The three nasals (ɑ̃, ɛ̃, ɔ̃) differ by tongue position and rounding, not by the consonant after them — there is none.',
    difficulty: 0.7, heardAs: 'ɑ̃', l1: l1(0.05, 'ɑ̃'),
  },
  {
    id: 'ø', label: 'eu', name: 'Round EH', example: 'deux', category: 'vowel',
    pose: pose({ open: 0.3, round: 0.7, spread: 0, tongue: 'high-front' }),
    tip: {
      little: 'Say “ay”, then make your lips into a little circle.',
      junior: 'Say “ay” as in day, stop halfway, and round your lips. The tongue stays forward.',
      teen: 'Close-mid front rounded vowel: the tongue of /e/ with rounded lips. Do not let it become /ɜ/ or /u/.',
    },
    steps: ['Say “ay” and hold', 'Round your lips', 'Tongue stays forward'],
    problem: 'This vowel needs rounded lips with the tongue forward.',
    detail: '/ø/ as in deux, bleu, peu. Usually replaced by English "uh" or "oo", both of which move the tongue back.',
    difficulty: 0.75, heardAs: 'u', l1: l1(0.1, 'u'),
  },
  {
    id: 'œ', label: 'eu / œu', name: 'Open round EH', example: 'sœur', category: 'vowel',
    pose: pose({ open: 0.45, round: 0.6, spread: 0, tongue: 'high-front' }),
    tip: {
      little: 'Like the sound in “deux”, but open your mouth a bit wider.',
      junior: 'The same rounded lips as “deux”, with the mouth a little more open. Say it as one short sound.',
      teen: 'Open-mid front rounded vowel — the open counterpart of /ø/. In practice the pair is decided by the syllable, so the rounding matters far more than the height.',
    },
    steps: ['Round your lips', 'Open a little wider than “deux”', 'Keep it short'],
    problem: 'Rounded lips, mouth slightly more open.',
    detail: '/œ/ as in sœur, fleur, jeune. Beginners may treat it as the same sound as /ø/; the rounding is what carries the word.',
    difficulty: 0.65, heardAs: 'ø', l1: l1(0.05, 'ø'),
  },
  {
    id: 'ʒ', label: 'j / g', name: 'Soft J', example: 'je', category: 'consonant',
    pose: pose({ open: 0.25, round: 0.4, tongue: 'ridge', air: 'stream' }),
    tip: {
      little: 'Buzz like a bee behind your teeth — “zh”. No d at the front!',
      junior: 'Say “sh”, then switch your voice on so it buzzes. It starts straight away — there is no d sound first.',
      teen: 'Voiced postalveolar fricative. English has it only inside words (vision); at the start of a word it is easily hardened into /dʒ/.',
    },
    steps: ['Start from “sh”', 'Switch your voice on', 'No d at the front'],
    problem: 'This is a smooth buzz, not a “j” with a d in front.',
    detail: '/ʒ/ as in je, jour, rouge. English speakers give /dʒ/ (jam); Cantonese speakers often give /z/ or /tʃ/.',
    difficulty: 0.55, heardAs: 'dʒ', l1: l1(0.15, 'z'),
  },
  {
    id: 'ɲ', label: 'gn', name: 'Squashed N', example: 'montagne', category: 'consonant',
    pose: pose({ open: 0.25, tongue: 'high-front', air: 'nose' }),
    tip: {
      little: 'Say “ny” all in one go — like the middle of “onion”.',
      junior: 'Press the middle of your tongue flat against the roof of your mouth and hum. It is one sound, not “n” then “y”.',
      teen: 'Palatal nasal: the tongue body contacts the hard palate. English approximates it as /nj/ across a syllable boundary.',
    },
    steps: ['Tongue flat on the roof', 'Hum through the nose', 'One sound, not two'],
    problem: 'This is one sound made with the middle of the tongue.',
    detail: '/ɲ/ as in montagne, Espagne, agneau. Nearly always produced as /nj/, which is close enough to be understood but not French.',
    difficulty: 0.45, l1: l1(0.05),
  },
];
