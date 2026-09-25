import type { PhonemeId } from '../../domain/types';

// Korean as it is spoken: a string of syllable blocks, each an initial consonant, a vowel and an optional final
// consonant (받침). Every item carries its PRONOUNCED form (`ko.pron`) beside what is written (`text`): 국물 is said
// 궁물, 같이 is said 가치, 있어요 is said 이써요 — spelling and sound part company in Korean the way they do in French,
// and a rule engine would guess wrong often enough to coach a child on a mistake they did not make. So the pronounced
// form is written by hand, like the pinyin of a Mandarin item, and everything here works from it: the beats for the
// time limit and the display, the romanisation (Revised Romanization, from the sound, as the standard says), the
// taught sound each block belongs to, and the sound sequence the scorer's per-sound scores are lined up with
// (src/speech/ko/assess.ts — Azure scores ko-KR per sound and names none of them, as for Japanese).

export interface Block {
  /** The block as written in the pronounced form. */
  block: string;
  initial: string;
  medial: string;
  /** '' when open; otherwise one of the seven sounds a Korean syllable can end in (ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ) or a cluster left as written. */
  final: string;
  romaja: string;
  /** The sound this block is taught as, when it is one of the six (ko/sounds.ts). */
  unit?: PhonemeId;
}

const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const MEDIALS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const R_INITIAL: Record<string, string> = { ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h' };
const R_MEDIAL: Record<string, string> = { ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i' };
/** Finals in a pronounced form: the seven representative sounds. Anything else is a spelling left in by mistake — it is romanised as written. */
const R_FINAL: Record<string, string> = { ㄱ: 'k', ㄴ: 'n', ㄷ: 't', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p', ㅇ: 'ng', ㅅ: 't', ㅆ: 't', ㅈ: 't', ㅊ: 't', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 't', ㄲ: 'k' };

/** The sounds of a block for the scorer, in order (ㅇ at the start is silence; a final ㅇ is ŋ). */
const S_INITIAL: Record<string, string> = { ㄱ: 'k', ㄲ: 'k͈', ㄴ: 'n', ㄷ: 't', ㄸ: 't͈', ㄹ: 'ɾ', ㅁ: 'm', ㅂ: 'p', ㅃ: 'p͈', ㅅ: 's', ㅆ: 's͈', ㅇ: '', ㅈ: 'tɕ', ㅉ: 'tɕ͈', ㅊ: 'tɕʰ', ㅋ: 'kʰ', ㅌ: 'tʰ', ㅍ: 'pʰ', ㅎ: 'h' };
/** A vowel: one sound, or a glide and a vowel — Azure may count either way, so both are offered (see phoneCandidates). */
const S_MEDIAL: Record<string, string[]> = { ㅏ: ['a'], ㅐ: ['ɛ'], ㅑ: ['j', 'a'], ㅒ: ['j', 'ɛ'], ㅓ: ['ʌ'], ㅔ: ['e'], ㅕ: ['j', 'ʌ'], ㅖ: ['j', 'e'], ㅗ: ['o'], ㅘ: ['w', 'a'], ㅙ: ['w', 'ɛ'], ㅚ: ['w', 'e'], ㅛ: ['j', 'o'], ㅜ: ['u'], ㅝ: ['w', 'ʌ'], ㅞ: ['w', 'e'], ㅟ: ['w', 'i'], ㅠ: ['j', 'u'], ㅡ: ['ɯ'], ㅢ: ['ɯ', 'i'], ㅣ: ['i'] };
const S_FINAL: Record<string, string> = { ㄱ: 'k̚', ㄴ: 'n', ㄷ: 't̚', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p̚', ㅇ: 'ŋ' };

const isHangul = (c: string): boolean => c >= '가' && c <= '힣';
/** Every hangul block in a text, in order; spaces and punctuation are not beats. */
export const hangulBlocks = (text: string): string[] => [...text].filter(isHangul);

export function decompose(block: string): { initial: string; medial: string; final: string } {
  const code = block.charCodeAt(0) - 0xac00;
  return { initial: INITIALS[Math.floor(code / 588)], medial: MEDIALS[Math.floor((code % 588) / 28)], final: FINALS[code % 28] };
}

const TENSE = new Set(['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ']);
const ASPIRATED = new Set(['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ']);
const EO = new Set(['ㅓ', 'ㅕ', 'ㅝ']);
const EU = new Set(['ㅡ', 'ㅢ']);

/** The taught sound a block belongs to. Order matters: 떡 is taught as a tense sound before it is taught as a 받침. */
export const unitOf = (b: Pick<Block, 'initial' | 'medial' | 'final'>): PhonemeId | undefined => {
  if (TENSE.has(b.initial)) return 'ko:tense';
  if (ASPIRATED.has(b.initial)) return 'ko:aspirated';
  if (b.initial === 'ㄹ' || b.final === 'ㄹ') return 'ko:r';
  if (EO.has(b.medial)) return 'ko:eo';
  if (EU.has(b.medial)) return 'ko:eu';
  if (b.final) return 'ko:batchim';
  return undefined;
};

/** The blocks of a pronounced form, each with its romanisation and the sound it is taught as. */
export const blocks = (pron: string): Block[] =>
  hangulBlocks(pron).map((block) => {
    const { initial, medial, final } = decompose(block);
    const romaja = `${R_INITIAL[initial] ?? ''}${R_MEDIAL[medial] ?? ''}${final ? R_FINAL[final] ?? '' : ''}`;
    return { block, initial, medial, final, romaja, unit: unitOf({ initial, medial, final }) };
  });

/**
 * Revised Romanization of the pronounced form, word by word (spaces kept, punctuation dropped). From the sound,
 * as the standard says: 국물 [궁물] → gungmul, 같이 [가치] → gachi. Written under the Korean for a learner who cannot
 * read hangul yet; the hangul stays the thing to read.
 */
export const romanize = (pron: string): string =>
  pron.split(/\s+/).map((w) => blocks(w).map((b) => b.romaja).join('')).filter(Boolean).join(' ');

/** One beat per block: the recording time limit and the display go by it. */
export const blockCount = (text: string): number => hangulBlocks(text).length;

/**
 * The sound sequences a pronounced form may come back as from a scorer that counts sounds but names none: each
 * glide vowel (야, 와, 의…) as one sound or two. `block[k]` says which block sound k belongs to. At most 16 variants.
 */
export function phoneCandidates(pron: string): { phones: string[]; block: number[] }[] {
  const bs = blocks(pron);
  let variants: { phones: string[]; block: number[] }[] = [{ phones: [], block: [] }];
  bs.forEach((b, i) => {
    let initial = S_INITIAL[b.initial] ? [S_INITIAL[b.initial]] : [];
    const final = b.final && S_FINAL[b.final] ? [S_FINAL[b.final]] : [];
    const vowel = S_MEDIAL[b.medial] ?? ['a'];
    const vowelWays = vowel.length === 2 && variants.length < 16 ? [vowel, [vowel.join('')]] : [vowel];
    // A doubled consonant across blocks (안녕: n + n, 몰라: l + l) is ONE sound to the scorer (probed 2026-09-25:
    // 안녕하세요 came back as 9 sounds), so it is offered merged as well — the merged sound belongs to the 받침 block.
    const prev = bs[i - 1];
    const doubled = prev && prev.final && S_FINAL[prev.final] && S_INITIAL[b.initial] && SAME[S_FINAL[prev.final]] === S_INITIAL[b.initial];
    const initialWays = doubled && variants.length < 16 ? [initial, []] : [initial];
    variants = variants.flatMap((v) => initialWays.flatMap((init) => vowelWays.map((way) => {
      const add = [...init, ...way, ...final];
      return { phones: [...v.phones, ...add], block: [...v.block, ...add.map(() => i)] };
    })));
    initial = [];
  });
  // Best guesses first: the ways that merge nothing come before the ways that do.
  return variants.sort((a, b) => b.phones.length - a.phones.length);
}

/** A final sound and the initial sound it doubles with: ㄴㄴ, ㅁㅁ, ㄹㄹ. */
const SAME: Record<string, string> = { n: 'n', m: 'm', l: 'ɾ' };
