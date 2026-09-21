import type { HomeLanguage } from '../../domain/types';
import type { MouthPose, PhonemeInfo } from '../phonemes';

// The Japanese sounds worth teaching, for a Hong Kong learner first and an English speaker second. Japanese has few
// sounds and most arrive for free; what does not is TIMING — Japanese is spoken in beats (morae) of equal length, and
// three of the nine below are beats a learner shortens or drops: the second half of a long vowel, the small っ, and ん.
// The rest are the consonants that do not exist in Cantonese (the flapped r, voiced z and が/だ/ば) or that English
// speakers get wrong (つ, ふ, and the small ゃゅょ said as two beats).
//
// The ids are namespaced "ja:…" like the Mandarin "zh:…", because they are beats and sound classes, not IPA symbols:
// `unitOf` in kana.ts decides which beat of a word belongs to which. Nothing here claims more than the scorer can
// measure — Azure scores Japanese sound by sound but names none of them; the names come from lining its scores up with
// the beats of the reading (src/speech/ja/assess.ts), and a line that does not line up is coached word by word.
//
// The wording here is the English source. Other App languages translate it in src/i18n/<language>/content.json under
// `sound.<id>.…`, read by `phonemeInfo` in ../phonemes.

const pose = (p: Partial<MouthPose>): MouthPose => ({ open: 0.3, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: true, ...p });
/** Cantonese and Mandarin speakers meet the same Japanese sounds the same way; English speakers are the default. */
const l1 = (boost: number): Partial<Record<HomeLanguage, { boost: number }>> => ({ yue: { boost }, zh: { boost } });

export const JA_SOUNDS: PhonemeInfo[] = [
  {
    id: 'ja:long', label: 'ー', name: 'Long vowels', example: 'おばあさん', category: 'vowel',
    pose: pose({ open: 0.55, spread: 0.25, tongue: 'low' }),
    tip: {
      little: 'Hold it for two claps: お・ば・あ・さ・ん! Grandma has a long “baa”.',
      junior: 'A long vowel lasts two beats. おばさん (aunt) and おばあさん (grandma) are different words — clap the beats as you say them.',
      teen: 'Vowel length changes the word in Japanese: a long vowel (ー, ああ, おう…) takes a full extra beat. Hold it steady for two beats, without a second push.',
    },
    steps: ['Clap the beats', 'Hold the vowel for two claps', 'Keep the sound steady'],
    problem: 'The long vowel was cut short — it needs two beats.',
    detail: 'Long vowels count double: おばあさん has five beats and おばさん four. Shortening one changes the word (おじいさん grandpa, おじさん uncle).',
    difficulty: 0.6, l1: l1(-0.05),
  },
  {
    id: 'ja:Q', label: 'っ', name: 'The little pause (っ)', example: 'きって', category: 'consonant',
    pose: pose({ open: 0.1, spread: 0.2, tongue: 'ridge' }),
    tip: {
      little: 'Stop for a tiny moment, like a hiccup: き・っ・て!',
      junior: 'The small っ is a silent beat: get your mouth ready for the next sound, count one, then go. きって (stamp) has three beats, きて (come) two.',
      teen: 'っ is a beat of held closure: hold the next consonant for one full beat before releasing it (kit-te). Add no vowel and no breath.',
    },
    steps: ['Get ready for the next sound', 'Hold still for one beat', 'Then say it'],
    problem: 'The little pause (っ) was missing — it needs a beat of its own.',
    detail: 'The small っ doubles the next consonant for one beat. Without it, きって (stamp) turns into きて (come).',
    difficulty: 0.55, l1: l1(-0.1),
  },
  {
    id: 'ja:N', label: 'ん', name: 'The n beat', example: 'みかん', category: 'consonant',
    pose: pose({ open: 0.15, tongue: 'ridge', air: 'nose' }),
    tip: {
      little: 'ん is a hum with its own clap: み・か・ん!',
      junior: 'ん is a whole beat by itself — hum it through your nose and give it as much time as any other beat.',
      teen: 'The moraic nasal ん takes a full beat; its exact sound follows the next consonant (m before b and p, ng before k and g). Don’t clip it.',
    },
    steps: ['Hum through your nose', 'Give it one full beat', 'Then move on'],
    problem: 'The ん beat was too short.',
    detail: 'ん is a beat of its own: みかん is three beats and ラーメン four.',
    difficulty: 0.4,
  },
  {
    id: 'ja:r', label: 'ら', name: 'Japanese R', example: 'りんご', category: 'consonant',
    pose: pose({ open: 0.3, tongue: 'ridge' }),
    tip: {
      little: 'Flick your tongue up behind your top teeth, very fast — a tiny tap!',
      junior: 'The Japanese r is one quick tap of the tongue tip just behind your top teeth — somewhere between an l and a d. Don’t curl your tongue.',
      teen: 'A voiced alveolar flap: one fast tap of the tongue tip on the ridge behind the teeth. Neither the curled English r nor a held l.',
    },
    steps: ['Tongue tip behind the top teeth', 'One quick tap', 'Straight into the vowel'],
    problem: 'The r sounded like an l or an English r — it is one quick tap.',
    detail: 'The r of ら り る れ ろ is a flap [ɾ]. Cantonese has no r and usually gives l; English speakers curl the tongue back.',
    difficulty: 0.55, l1: l1(0.15),
  },
  {
    id: 'ja:ts', label: 'つ', name: 'Tsu', example: 'つくえ', category: 'consonant',
    pose: pose({ open: 0.15, spread: 0.3, tongue: 'ridge', air: 'stream', voiced: false }),
    tip: {
      little: 'Say “ts”, like a tiny sneeze: tsu!',
      junior: 'つ starts with a quick “ts” — not “su” and not “tu”. Tongue behind the teeth, then let the air hiss out.',
      teen: 'A voiceless affricate [ts] before u: the stop and the hiss belong together. English speakers tend to say su or tu.',
    },
    steps: ['Tongue behind the top teeth', 'Stop the air, then hiss', 'A relaxed u'],
    problem: 'つ needs a “ts” at the start.',
    detail: 'つ is [tsɯ]. Cantonese already has this sound (the z of 早), so it usually comes easily; English speakers say su or tu.',
    difficulty: 0.45, l1: l1(-0.25),
  },
  {
    id: 'ja:f', label: 'ふ', name: 'Soft F', example: 'ふね', category: 'consonant',
    pose: pose({ open: 0.1, round: 0.4, spread: 0, air: 'stream', voiced: false }),
    tip: {
      little: 'Blow softly, like cooling hot soup — lips almost together: fu!',
      junior: 'ふ is made with the lips, not the teeth: blow gently through lips that almost touch, like blowing out a candle.',
      teen: 'A voiceless bilabial fricative: the air passes between lightly rounded lips, with no teeth on the lip as in English f.',
    },
    steps: ['Lips almost touching', 'No teeth on your lip', 'Blow softly'],
    problem: 'ふ is blown through the lips — don’t bite your lip.',
    detail: 'Japanese ふ is [ɸɯ]: the two lips make the friction, not the teeth on the lower lip as in English or Cantonese f.',
    difficulty: 0.35,
  },
  {
    id: 'ja:z', label: 'ず', name: 'Buzzy Z', example: 'みず', category: 'consonant',
    pose: pose({ open: 0.15, spread: 0.35, tongue: 'ridge', air: 'stream' }),
    tip: {
      little: 'Buzz like a bee: zzz — mi-zu!',
      junior: 'ず and じ buzz: your throat hums while the air hisses. If it comes out as s or ch, add the buzz.',
      teen: 'Voiced [z] or [dz], and [dʑ] for じ: keep the vocal folds vibrating through the hiss. Cantonese has no voiced z, so it tends to come out as s or ts.',
    },
    steps: ['Fingers on your throat', 'Hiss like s', 'Now make your throat buzz'],
    problem: 'The z sound needs a buzz in your throat.',
    detail: 'The ざ row and じ are voiced. Cantonese has no voiced z, so みず can come out as みす.',
    difficulty: 0.45, l1: l1(0.15),
  },
  {
    id: 'ja:voiced', label: 'が', name: 'Buzzy G, D, B', example: 'がっこう', category: 'consonant',
    pose: pose({ open: 0.35, tongue: 'high-back' }),
    tip: {
      little: 'Hum while you say it: ga! da! ba! Your throat should buzz.',
      junior: 'が, だ and ば are voiced: your throat buzzes as the sound starts. Without the buzz, が turns into か.',
      teen: 'Japanese tells voiced from voiceless (が/か, だ/た, ば/ぱ). Start the voicing before you release the consonant — Cantonese stops are all voiceless, so this is new.',
    },
    steps: ['Fingers on your throat', 'Start humming', 'Then say ga'],
    problem: 'That sound needs a buzz in your throat.',
    detail: 'Voicing is the only difference between が and か. Cantonese separates its stops by breath instead, so voiced ones need practice.',
    difficulty: 0.5, l1: l1(0.15),
  },
  {
    id: 'ja:y', label: 'きょ', name: 'Small ya, yu, yo', example: 'きゅうり', category: 'consonant',
    pose: pose({ open: 0.25, spread: 0.45, tongue: 'high-front' }),
    tip: {
      little: 'Squeeze it into one sound: kyu, not ki-yu!',
      junior: 'A small ゃ, ゅ or ょ joins the sound before it: きょ is one beat (kyo), not two (ki-yo).',
      teen: 'The small ゃゅょ make a single beat with the consonant before them (kyo). Don’t add an i beat in between.',
    },
    steps: ['Start the consonant', 'Glide straight into ya, yu or yo', 'One beat only'],
    problem: 'The small ya, yu or yo is one beat, not two.',
    detail: 'きゃ, きゅ, きょ and the others are single beats: きょう is two beats (kyo-o), not three.',
    difficulty: 0.3,
  },
];
