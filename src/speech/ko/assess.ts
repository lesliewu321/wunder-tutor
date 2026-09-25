import type { KoText, PhonemeScore, WordScore } from '../../domain/types';
import { blocks, phoneCandidates } from '../../content/ko/hangul';

/**
 * Put Korean blocks on Azure's Korean scores. Azure scores ko-KR per sound and per syllable but names neither (as
 * for Japanese), and splits a line into words its own way. What it keeps is the ORDER, so the whole line is lined up
 * at once, ignoring its word splits — the same three steps as src/speech/ja/assess.ts:
 *
 *   1. its sounds against the sounds of our pronounced form (ko/hangul.ts `phoneCandidates`: a glide vowel as one
 *      sound or two) — used when exactly one variant has the same number of sounds;
 *   2. otherwise its syllables against our blocks, when it scored the line block by block;
 *   3. otherwise nothing is named, and the feedback stays at the level of the word — never a guessed name.
 *
 * Each word's sounds are then replaced by one score per block (the lowest of the block's sounds), named by the taught
 * sound the block belongs to (ko:tense, ko:aspirated, ko:r…) or left unnamed. Not yet measured against live ko-KR
 * takes (2026-09-25): nothing downstream may claim more than "scored".
 */
export const nameKorean = (words: WordScore[], ko: KoText): WordScore[] => {
  const bs = blocks(ko.pron);
  if (!bs.length) return words;
  const spoken = words.map((w, i) => ({ w, i })).filter(({ w }) => w.errorType !== 'insertion');
  const scores: number[] = new Array(bs.length).fill(NaN);
  const cover = new Map<number, number[]>();
  const add = (wordIndex: number, block: number) => { const list = cover.get(wordIndex) ?? []; if (!list.includes(block)) list.push(block); cover.set(wordIndex, list); };

  const phones = spoken.flatMap(({ w, i }) => w.phonemes.map((p) => ({ word: i, score: p.score })));
  const fits = phones.length ? phoneCandidates(ko.pron).filter((c) => c.phones.length === phones.length) : [];
  const syllables = spoken.flatMap(({ w, i }) => w.syllables.map((s) => ({ word: i, score: s.score })));

  if (fits.length === 1) {
    const fit = fits[0];
    phones.forEach((p, k) => {
      const b = fit.block[k];
      scores[b] = Number.isNaN(scores[b]) ? p.score : Math.min(scores[b], p.score);
      add(p.word, b);
    });
  } else if (syllables.length === bs.length) {
    syllables.forEach((s, b) => { scores[b] = s.score; add(s.word, b); });
  } else {
    return words;
  }

  return words.map((w, i) => {
    const list = cover.get(i);
    if (!list) return w;
    const phonemes: PhonemeScore[] = list.sort((a, b) => a - b).map((b) => ({ phoneme: bs[b].unit ?? '', score: Math.round(scores[b]) }));
    return { ...w, phonemes };
  });
};
