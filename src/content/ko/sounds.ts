import type { HomeLanguage } from '../../domain/types';
import type { MouthPose, PhonemeInfo } from '../phonemes';

// The Korean sounds worth teaching, for a Hong Kong learner first and an English speaker second. Korean has few
// sounds a learner has never made; what it has is a THREE-WAY split that neither Cantonese, Mandarin nor English
// makes — plain, tense and aspirated (가 / 까 / 카) — two vowels English and Cantonese lack (ㅓ and ㅡ), a final
// consonant that is held and not released (받침: 밥 ends with the lips closed), and ㄹ, which is a tap between
// vowels and an l at the end of a syllable. Six sounds, each a block of the pronounced form belongs to (ko/hangul.ts
// `unitOf`).
//
// The ids are namespaced "ko:…" like the Mandarin "zh:…" and Japanese "ja:…", because they are classes of block,
// not IPA symbols. Nothing here claims more than the scorer can measure — Azure scores ko-KR sound by sound but
// names none of them; the names come from lining its scores up with the blocks of the pronounced form
// (src/speech/ko/assess.ts), and a line that does not line up is coached word by word.
//
// The wording here is the English source. Other App languages translate it in src/i18n/<language>/content.json under
// `sound.<id>.…`, read by `phonemeInfo` in ../phonemes.

const pose = (p: Partial<MouthPose>): MouthPose => ({ open: 0.3, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: true, ...p });
/** Cantonese and Mandarin speakers meet the three-way split the same way; English speakers are the default. */
const l1 = (boost: number): Partial<Record<HomeLanguage, { boost: number }>> => ({ yue: { boost }, zh: { boost }, en: { boost } });

export const KO_SOUNDS: PhonemeInfo[] = [
  {
    id: 'ko:tense', label: 'ㄲ ㄸ ㅃ ㅆ ㅉ', name: 'Tight sounds', example: '떡', category: 'consonant',
    pose: pose({ open: 0.15, spread: 0.3, tongue: 'ridge', air: 'none', voiced: false }),
    tip: {
      little: 'Squeeze your throat tight, then let the sound pop out with NO puff of air — like a tiny “tt!”',
      junior: 'Tense sounds are squeezed: hold your breath for a moment, then let the sound out with no puff of air. Put your hand in front of your mouth — nothing should blow on it.',
      teen: 'Tense (fortis) consonants: glottal tension, no aspiration, a slightly higher pitch on the following vowel. 딸 (daughter) and 달 (moon) differ only here.',
    },
    steps: ['Hold your breath for a moment', 'Let the sound pop out', 'No puff of air on your hand'],
    problem: 'A tight sound came out plain or puffed.',
    detail: 'ㄲ ㄸ ㅃ ㅆ ㅉ are made with a tense throat and no breath. English has nothing like them; a learner says 까 as 가 or 카.',
    difficulty: 0.85, l1: l1(0.2),
  },
  {
    id: 'ko:aspirated', label: 'ㅋ ㅌ ㅍ ㅊ', name: 'Puffy sounds', example: '커피', category: 'consonant',
    pose: pose({ open: 0.25, spread: 0.2, tongue: 'ridge', air: 'puff', voiced: false }),
    tip: {
      little: 'Blow a big puff of air with the sound — feel it on your hand!',
      junior: 'Puffy sounds come with a strong puff of air, much stronger than in English. Hold your hand in front of your mouth: it should feel the wind.',
      teen: 'Aspirated consonants carry heavy aspiration — more than English p, t, k at the start of a word. 탈 (mask) vs 달 (moon) vs 딸 (daughter).',
    },
    steps: ['Get the sound ready', 'Blow a strong puff with it', 'Feel the air on your hand'],
    problem: 'A puffy sound came out without its puff.',
    detail: 'ㅋ ㅌ ㅍ ㅊ are aspirated hard. Cantonese and Mandarin have aspirated stops, so the puff is familiar; the trouble is keeping it apart from the tense series.',
    difficulty: 0.6, l1: l1(0.1),
  },
  {
    id: 'ko:r', label: 'ㄹ', name: 'Korean L / R', example: '물', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'ridge', air: 'stream' }),
    tip: {
      little: 'Tap the top of your mouth with your tongue, quick as a flick — “r”! At the end of a word, hold it: “l”.',
      junior: 'Between vowels ㄹ is a quick tap of the tongue tip (like the Japanese r). At the end of a syllable it is an l with the tongue held up.',
      teen: 'ㄹ is a flap [ɾ] between vowels (우리) and a lateral [l] in the coda (물). Neither is the English r: no lip rounding, no curling back.',
    },
    steps: ['Tongue tip to the ridge', 'One quick tap between vowels', 'Hold it as an l at the end'],
    problem: 'ㄹ sounded like an English r or a w.',
    detail: 'One letter, two sounds: a tap between vowels, an l at the end of a syllable. English speakers round their lips for it; Cantonese speakers may drop it at the end.',
    difficulty: 0.65, l1: l1(0.15),
  },
  {
    id: 'ko:eo', label: 'ㅓ', name: 'Open O', example: '서울', category: 'vowel',
    pose: pose({ open: 0.55, round: 0.1, tongue: 'low' }),
    tip: {
      little: 'Open your mouth wide and say “uh” — like the “o” in “not”, with no round lips.',
      junior: 'ㅓ is between “o” and “uh”: open the mouth, keep the lips relaxed and unrounded. ㅗ is the rounded one.',
      teen: 'ㅓ [ʌ] is a mid-back unrounded vowel — jaw open, lips relaxed. It contrasts with rounded ㅗ [o]: 서 (Seo) vs 소 (cow).',
    },
    steps: ['Open the jaw', 'Keep the lips loose, not round', 'Say “uh” with the mouth open'],
    problem: 'ㅓ came out as ㅗ (rounded) or as “a”.',
    detail: 'The vowel English spells “eo” in Seoul. Learners round it into ㅗ or flatten it into ㅏ.',
    difficulty: 0.7, l1: l1(0.15),
  },
  {
    id: 'ko:eu', label: 'ㅡ', name: 'Flat U', example: '그', category: 'vowel',
    pose: pose({ open: 0.15, spread: 0.6, tongue: 'high-back' }),
    tip: {
      little: 'Smile and say “oo” without moving your lips — a flat, hidden “oo”!',
      junior: 'ㅡ is an “oo” with the lips spread flat, not rounded: smile, keep the tongue high and back, and say “oo”.',
      teen: 'ㅡ [ɯ] is a close back unrounded vowel: the tongue position of “oo” with spread lips. English has no such vowel; ㅜ is the rounded partner.',
    },
    steps: ['Smile', 'Tongue high and back', 'Say “oo” without rounding'],
    problem: 'ㅡ came out rounded, like ㅜ.',
    detail: 'The commonest vowel confusion for English and Cantonese speakers, who round it into ㅜ or say ㅣ.',
    difficulty: 0.75, l1: l1(0.15),
  },
  {
    id: 'ko:batchim', label: '받침', name: 'Final stop', example: '밥', category: 'consonant',
    pose: pose({ open: 0.1, tongue: 'rest', air: 'none' }),
    tip: {
      little: 'Close your mouth on the last sound and STOP — don’t let it pop out!',
      junior: 'A final consonant is held, not released: 밥 ends with the lips shut and no “p” sound escaping. Stop the sound, don’t finish it.',
      teen: 'Coda consonants are unreleased [p̚ t̚ k̚]: close and hold. An English-style release adds a puff or a vowel (밥 → “bapuh”).',
    },
    steps: ['Say the syllable', 'Close on the last sound', 'Hold it — no release'],
    problem: 'The final sound was released or dropped.',
    detail: 'Cantonese has the same unreleased finals (-p -t -k), an advantage; English and Mandarin speakers release them or add a vowel.',
    difficulty: 0.5, l1: { en: { boost: 0.2 }, zh: { boost: 0.2 }, yue: { boost: -0.1 } },
  },
];
