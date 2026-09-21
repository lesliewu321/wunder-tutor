import type { JaText, PhonemeScore, WordScore } from '../../domain/types';
import { morae, phoneCandidates } from '../../content/ja/kana';

/**
 * Put Japanese beats on Azure's Japanese scores. Azure scores ja-JP per sound and per syllable but names neither, and
 * splits a line into words its own way (きって came back as きっ + て, おばあさん as お + ばあさん). What it keeps is the
 * ORDER, so the whole line is lined up at once, ignoring its word splits:
 *
 *   1. its sounds against the sounds of our reading (kana.ts `phoneCandidates`: a long vowel as one sound or two, を as
 *      o or wo) — used when exactly one variant has the same number of sounds;
 *   2. otherwise its syllables against our beats, when it scored the line beat by beat (ください: 4 and 4);
 *   3. otherwise nothing is named, and the feedback stays at the level of the word — never a guessed name.
 *
 * Each word's sounds are then replaced by one score per beat (the lowest of the beat's sounds), named by the taught
 * sound the beat belongs to (ja:long, ja:Q, ja:r…) or left unnamed. Measured on the teacher's own takes and on its
 * mistakes (2026-09-21): おばさん said for おばあさん scored the long beat 42 against 95+ for the rest; きて said for
 * きって put っ at 51. Voicing (が said as か: 84) and some long vowels (ビル for ビール) Azure does not catch at all, so
 * nothing downstream may claim that it does.
 */
export const nameJapanese = (words: WordScore[], ja: JaText): WordScore[] => {
  const beats = morae(ja.kana);
  if (!beats.length) return words;
  const spoken = words.map((w, i) => ({ w, i })).filter(({ w }) => w.errorType !== 'insertion');
  const scores: number[] = new Array(beats.length).fill(NaN);
  /** For every scored word, the beats it covers, in order. */
  const cover = new Map<number, number[]>();
  const add = (wordIndex: number, beat: number) => { const list = cover.get(wordIndex) ?? []; if (!list.includes(beat)) list.push(beat); cover.set(wordIndex, list); };

  const phones = spoken.flatMap(({ w, i }) => w.phonemes.map((p) => ({ word: i, score: p.score })));
  const fits = phones.length ? phoneCandidates(ja.kana).filter((c) => c.phones.length === phones.length) : [];
  const syllables = spoken.flatMap(({ w, i }) => w.syllables.map((s) => ({ word: i, score: s.score })));

  if (fits.length === 1) {
    const fit = fits[0];
    phones.forEach((p, k) => {
      const b = fit.mora[k];
      scores[b] = Number.isNaN(scores[b]) ? p.score : Math.min(scores[b], p.score);
      add(p.word, b);
    });
    // A long vowel written as ONE sound belongs to two beats: the second takes the score of the vowel it lengthens.
    beats.forEach((m, b) => {
      if (!m.long || !Number.isNaN(scores[b]) || b === 0) return;
      const lastOfPrev = [...fit.mora.keys()].reverse().find((k) => fit.mora[k] === b - 1);
      if (lastOfPrev === undefined) return;
      scores[b] = phones[lastOfPrev].score;
      add(phones[lastOfPrev].word, b);
    });
  } else if (syllables.length === beats.length) {
    syllables.forEach((s, b) => { scores[b] = s.score; add(s.word, b); });
  } else {
    return words;
  }

  return words.map((w, i) => {
    const list = cover.get(i);
    if (!list) return w;
    const phonemes: PhonemeScore[] = list.sort((a, b) => a - b).map((b) => ({ phoneme: beats[b].unit ?? '', score: Math.round(scores[b]) }));
    return { ...w, phonemes };
  });
};
