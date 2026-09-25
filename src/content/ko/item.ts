import type { PhonemeId, SpeakItem } from '../../domain/types';
import { blockCount } from './hangul';

// A Korean speaking item from what is written and how it is said. `text` is the line as written (what the scorer
// is sent and what the learner reads), `pron` the same line with the sound changes applied (국물 → 궁물), `romaja`
// the Revised Romanization by hand. The id is the romaja, so the same line shares progress wherever it appears:
// `ko-mul-juseyo`. Used by the TypeScript scenario file; the course data (content/courses/ko.json) writes the same
// fields and ids by hand and the loader checks them.

export const koId = (romaja: string): string => `ko-${romaja.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`;

export const koKind = (text: string): SpeakItem['kind'] => {
  const blocks = blockCount(text);
  const words = text.trim().split(/\s+/).length;
  if (blocks <= 1) return 'word';
  return /[.!?。！？]$/.test(text.trim()) && blocks > 3 ? 'sentence' : words === 1 ? 'word' : 'phrase';
};

export const ko = (text: string, pron: string, romaja: string, meaning?: string, picture?: string, focus?: PhonemeId[]): SpeakItem => ({
  id: koId(romaja), text, lang: 'ko-KR', ko: { pron, romaja }, picture, meaning, focus, kind: koKind(text),
});
