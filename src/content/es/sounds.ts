import type { HomeLanguage, PhonemeId } from '../../domain/types';
import type { MouthPose, PhonemeInfo } from '../phonemes';

// The Spanish sounds worth teaching (Spain): the rolled rr and the single tap r, the jota, ñ, the Castilian "th"
// of c/z, b and v said the same way, ll said like y, and the five pure vowels — the sounds a Cantonese, Mandarin or
// English speaker gets wrong, not the ones a textbook lists first. Everything else arrives for free.
//
// The ids are namespaced "es:…" although the sounds are ordinary IPA, because r, θ and ð are already English
// catalogue ids and ɲ a French one: a Spanish tap must never share a slot with an English r in a learner's profile.
// Sounds from spelling: es/lexicon.ts. Azure scores es-ES sound by sound but names none of them; the names come from
// lining its scores up with the lexicon's sequence, as for French (src/speech/azureProvider.ts).
//
// The wording here is the English source. Other App languages translate it in src/i18n/<language>/content.json under
// `sound.<id>.…`, read by `phonemeInfo` in ../phonemes.

const pose = (p: Partial<MouthPose>): MouthPose => ({ open: 0.3, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: true, ...p });
const l1 = (boost: number, heardAs?: PhonemeId): Partial<Record<HomeLanguage, { boost: number; heardAs?: PhonemeId }>> =>
  ({ yue: { boost, heardAs }, zh: { boost, heardAs }, en: { boost, heardAs } });

export const ES_SOUNDS: PhonemeInfo[] = [
  {
    id: 'es:rr', label: 'rr', name: 'Rolled R', example: 'perro', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'ridge', air: 'stream' }),
    tip: {
      little: 'Make your tongue flutter like a motorbike: “rrrr”!',
      junior: 'Rest the tongue tip just behind your top teeth and blow so it flutters: rr-rr-rr. Perro (dog) has the roll; pero (but) has one tap.',
      teen: 'The alveolar trill [r]: tongue tip relaxed at the ridge, airflow makes it vibrate 2–3 times. Written rr between vowels and r at the start of a word (rojo).',
    },
    steps: ['Tongue tip behind the top teeth', 'Blow steadily', 'Let the tip flutter'],
    problem: 'The rr did not roll.',
    detail: 'perro / pero, carro / caro: one roll changes the word. The roll takes practice for everyone; start with “tr” and “dr”.',
    difficulty: 0.9, heardAs: 'es:r', l1: l1(0.2, 'es:r'),
  },
  {
    id: 'es:r', label: 'r', name: 'Tap R', example: 'pero', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'ridge', air: 'stream' }),
    tip: {
      little: 'Tap the top of your mouth once with your tongue, quick as a flick!',
      junior: 'A single r is one quick tap of the tongue tip — like the “tt” in American “butter”. Never the English r.',
      teen: 'The alveolar tap [ɾ] between vowels (pero, cara): one contact, no lip rounding, no curling back.',
    },
    steps: ['Tongue tip up', 'One quick tap', 'Straight into the next vowel'],
    problem: 'The r sounded like an English r.',
    detail: 'English speakers round and curl their r; Cantonese speakers reach for l or w. One tap is all it takes.',
    difficulty: 0.6, heardAs: 'r', l1: l1(0.15),
  },
  {
    id: 'es:j', label: 'j / ge / gi', name: 'Jota', example: 'jamón', category: 'consonant',
    pose: pose({ open: 0.35, tongue: 'high-back', air: 'stream', voiced: false }),
    tip: {
      little: 'Make a soft, scratchy sound at the back of your throat — like blowing on cold hands, but rougher!',
      junior: 'The jota is made where you say “k”, but with the air rasping through instead of stopping: a rough “h”. jamón, rojo, gente.',
      teen: 'The voiceless velar fricative [x] (Spain: often uvular): friction at the back, never an English h or j.',
    },
    steps: ['Tongue back, near the “k” place', 'Let the air rasp through', 'Keep it voiceless'],
    problem: 'The jota came out as an English h or j.',
    detail: 'j, and g before e or i. Cantonese h is close but softer; English speakers say “h” or the “j” of jam.',
    difficulty: 0.7, l1: l1(0.15),
  },
  {
    id: 'es:ñ', label: 'ñ', name: 'Eñe', example: 'niño', category: 'consonant',
    pose: pose({ open: 0.2, spread: 0.3, tongue: 'high-front', air: 'nose' }),
    tip: {
      little: 'Say “n” with your tongue flat against the roof of your mouth — “nyuh”!',
      junior: 'ñ is one sound: the middle of the tongue presses the roof of the mouth, and the sound comes through the nose. Like “ny” in canyon, but in one go.',
      teen: 'The palatal nasal [ɲ]: tongue body against the hard palate. Not n + y — one gesture (año vs ano).',
    },
    steps: ['Tongue body to the roof of the mouth', 'Hum through the nose', 'Release into the vowel'],
    problem: 'ñ sounded like a plain n.',
    detail: 'niño, mañana, España. Cantonese and Mandarin speakers know a similar sound; English speakers split it into n + y or drop the y.',
    difficulty: 0.5, heardAs: 'n', l1: l1(0.1),
  },
  {
    id: 'es:z', label: 'z / ce / ci', name: 'Spanish TH', example: 'zumo', category: 'consonant',
    pose: pose({ open: 0.25, tongue: 'between-teeth', air: 'stream', voiced: false }),
    tip: {
      little: 'Stick your tongue out a little and blow: “th” — like in “thin”!',
      junior: 'In Spain, z and c before e or i sound like the English “th” in thin: zumo, cero, gracias. Tongue between the teeth, air out.',
      teen: 'Distinción: [θ] for z and c+e/i, [s] for s. Latin America merges them into s (seseo); this course teaches Spain.',
    },
    steps: ['Tongue tip between the teeth', 'Blow gently', 'No voice'],
    problem: 'z or c sounded like s.',
    detail: 'casa (house) vs caza (hunt). Cantonese and Mandarin have no th; an s is the usual substitute.',
    difficulty: 0.65, heardAs: 's', l1: l1(0.2, 's'),
  },
  {
    id: 'es:b', label: 'b / v', name: 'B and V', example: 'vaca', category: 'consonant',
    pose: pose({ open: 0.1, tongue: 'rest' }),
    tip: {
      little: 'b and v are the SAME sound in Spanish — press your lips together for both!',
      junior: 'Spanish has no v sound: vaca is said with the lips like b. Between vowels it goes soft, the lips barely touching (uva).',
      teen: 'b and v are one phoneme: [b] after a pause or nasal, the approximant [β] between vowels. Never the English lip-teeth v.',
    },
    steps: ['Lips together for b and v', 'Between vowels: barely touch', 'No teeth on the lip'],
    problem: 'v was said with the teeth, like English.',
    detail: 'vaca, vino, uva. English speakers bring in their v; Cantonese speakers may say w.',
    difficulty: 0.45, l1: { en: { boost: 0.2, heardAs: 'v' }, yue: { boost: 0.1, heardAs: 'w' }, zh: { boost: 0.1, heardAs: 'w' } },
  },
  {
    id: 'es:ll', label: 'll / y', name: 'Elle', example: 'llave', category: 'consonant',
    pose: pose({ open: 0.2, spread: 0.3, tongue: 'high-front' }),
    tip: {
      little: 'll is said like a strong “y” — “ya”, “yo”!',
      junior: 'In Spain today ll sounds like y: llave, pollo, calle. A strong y, with the tongue close to the roof of the mouth.',
      teen: 'Yeísmo: ll and y merge into [ʝ] (a fricative y), the standard in Madrid. Not an l.',
    },
    steps: ['Tongue close to the roof of the mouth', 'A strong y', 'Never an l'],
    problem: 'll sounded like an l.',
    detail: 'pollo (chicken) vs polo (ice lolly). A learner who reads ll as l says the wrong word.',
    difficulty: 0.4, heardAs: 'l', l1: l1(0.15, 'l'),
  },
  {
    id: 'es:vowel', label: 'a e i o u', name: 'Pure vowels', example: 'cosa', category: 'vowel',
    pose: pose({ open: 0.5, spread: 0.2, tongue: 'low' }),
    tip: {
      little: 'Five vowels, always the same: a-e-i-o-u. Short and clear, no sliding!',
      junior: 'Spanish vowels never change and never slide: o is “o”, not “oh-oo”; e is “e”, not “ay”. Keep them short and pure.',
      teen: 'Five monophthongs, no reduction: unstressed vowels keep their full quality (no schwa), and o/e are not diphthongised as in English “go” and “say”.',
    },
    steps: ['One vowel, one sound', 'Keep it short', 'No gliding at the end'],
    problem: 'A vowel slid or turned into “uh”.',
    detail: 'English speakers glide o and e and weaken unstressed vowels; Cantonese speakers do better here.',
    difficulty: 0.45, l1: { en: { boost: 0.2 }, zh: { boost: 0.05 }, yue: { boost: 0 } },
  },
];
