import type { PhonemeId, SpeakItem } from '../../domain/types';

// A Mandarin speaking item from its three spellings. `hans` is what the scorer is sent (Simplified), `hant` is what a
// Hong Kong child reads, `py` is numbered pinyin with CITATION tones, one syllable per character. Tone changes in
// running speech (你好 → ní hǎo, 一杯 → yì bēi, 不客气 → bú kè qi) are computed by surfaceTones(), never typed by hand.
// The id is the pinyin, so the same line shares progress wherever it appears: `zh-wo3-xiang3-he1-shui3-s`.

const HAN = /\p{Script=Han}/u;

const kindOf = (hans: string, syllables: number): SpeakItem['kind'] =>
  syllables === 1 ? 'word' : /[。！？]$/.test(hans) && syllables > 3 ? 'sentence' : syllables <= 3 && !/[。！？，]/.test(hans) ? 'word' : 'phrase';

export const zhItem = (hans: string, hant: string, py: string, meaning?: string, picture?: string, focus?: PhonemeId[]): SpeakItem => {
  const syllables = py.trim().split(/\s+/);
  const chars = [...hans].filter((c) => HAN.test(c));
  if (chars.length !== syllables.length) throw new Error(`pinyin/character count mismatch in ${hans}: ${chars.length} vs ${syllables.length}`);
  return {
    id: `zh-${syllables.join('-')}${/[。！？]$/.test(hans) ? '-s' : ''}`,
    text: hans, lang: 'zh-CN', zh: { hant, py }, picture, meaning, focus, kind: kindOf(hans, syllables.length),
  };
};

/** The old name, kept for the scenario files. */
export const zi = zhItem;
