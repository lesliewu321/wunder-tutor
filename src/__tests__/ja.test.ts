import { describe, expect, it } from 'vitest';
import type { WordScore } from '../domain/types';
import { findLesson } from '../content/course';
import { JA_CHECK_ITEMS, JA_COURSE, JA_ITEMS, JA_LAB_SOUNDS, JA_LADDERS } from '../content/ja/course';
import { moraCount, morae, parseJa, phoneCandidates, romajiOf, writtenKana } from '../content/ja/kana';
import { JA_SOUNDS } from '../content/ja/sounds';
import { phonemeInfo } from '../content/phonemes';
import { nameJapanese } from '../speech/ja/assess';

/** An Azure-shaped Japanese word: unnamed sounds and syllables, as ja-JP returns them. */
const word = (text: string, phones: number[], syllables: number[] = []): WordScore => ({
  word: text, score: Math.min(...phones), errorType: 'none',
  phonemes: phones.map((score) => ({ phoneme: '', score })), syllables: syllables.map((score) => ({ text: '', score })),
});

describe('Japanese beats', () => {
  it('counts the beats a learner loses: long vowels, the small っ, ん', () => {
    expect(moraCount('おばあさん')).toBe(5);
    expect(moraCount('おばさん')).toBe(4);
    expect(moraCount('きって')).toBe(3);
    expect(moraCount('きて')).toBe(2);
    expect(moraCount('こんにちは')).toBe(5);
    expect(moraCount('ラーメン')).toBe(4);
    expect(moraCount('きょう')).toBe(2); // きょ is one beat, not ki-yo
  });

  it('writes romaji the way a textbook does, long vowels marked', () => {
    expect(romajiOf('ありがとう')).toBe('arigatō');
    expect(romajiOf('ラーメン')).toBe('rāmen');
    expect(romajiOf('おばあさん')).toBe('obāsan');
    expect(romajiOf('おじいさん')).toBe('ojiisan');
    expect(romajiOf('きって')).toBe('kitte');
    expect(romajiOf('ぎゅうにゅう')).toBe('gyūnyū');
    expect(romajiOf('せんせい')).toBe('sensei'); // えい stays ei
    expect(romajiOf('いらっしゃいませ')).toBe('irasshaimase');
    expect(romajiOf('ちょっと')).toBe('chotto');
    expect(romajiOf('はい、どうぞ！')).toBe('hai, dōzo!');
  });

  it('knows which taught sound each beat is', () => {
    expect(morae('ラーメン').map((m) => m.unit)).toEqual(['ja:r', 'ja:long', undefined, 'ja:N']);
    expect(morae('きって').map((m) => m.unit)).toEqual([undefined, 'ja:Q', undefined]);
    expect(morae('みず').map((m) => m.unit)).toEqual([undefined, 'ja:z']);
    expect(morae('がっこう').map((m) => m.unit)).toEqual(['ja:voiced', 'ja:Q', undefined, 'ja:long']);
    expect(morae('つくえ')[0].unit).toBe('ja:ts');
    expect(morae('ふね')[0].unit).toBe('ja:f');
    expect(morae('きゅうり')[0].unit).toBe('ja:y');
  });

  it('reads a line written with its readings: kanji get furigana, particles are said as said, spaces mark words', () => {
    const { text, ja } = parseJa('{水|みず} を ください');
    expect(text).toBe('水をください');
    expect(ja.kana).toBe('みずをください');
    expect(ja.romaji).toBe('mizu o kudasai');
    expect(ja.ruby[0]).toEqual({ text: '水', reading: 'みず' });
    const hello = parseJa('こんにち{は|わ}');
    expect(hello.text).toBe('こんにちは');
    expect(hello.ja.romaji).toBe('konnichiwa');
    expect(() => parseJa('水をください')).toThrow(/kanji without a reading/);
    // A child sees こんにちは written as it is written, never the こんにちわ it is said as.
    expect(writtenKana(hello.ja)).toBe('こんにちは');
    expect(writtenKana(parseJa('{水|みず} を ください').ja)).toBe('みずをください');
    expect(moraCount(writtenKana(hello.ja))).toBe(moraCount(hello.ja.kana));
  });

  it('offers a long vowel as one sound or two, since Azure writes it both ways', () => {
    expect(phoneCandidates('ラーメン').map((c) => c.phones.length).sort()).toEqual([5, 6]);
    expect(phoneCandidates('おばあさん').map((c) => c.phones.length).sort()).toEqual([6, 7]);
  });
});

describe('naming Azure’s Japanese scores (numbers from the 2026-09-21 probe)', () => {
  it('finds the long vowel a learner cut short (おばさん said for おばあさん)', () => {
    const words = nameJapanese([word('お', [100, 100]), word('ばあさん', [53, 42, 36, 95, 97])], parseJa('おばあさん').ja);
    const beats = words.flatMap((w) => w.phonemes);
    const long = beats.find((p) => p.phoneme === 'ja:long')!;
    expect(long.score).toBe(42);
    expect(Math.min(...beats.map((p) => p.score))).toBeLessThanOrEqual(42);
  });

  it('finds the missing little pause (きて said for きって)', () => {
    const words = nameJapanese([word('きっ', [100, 96, 51]), word('て', [65, 80])], parseJa('{切手|きって}').ja);
    expect(words[0].phonemes.find((p) => p.phoneme === 'ja:Q')!.score).toBe(51);
  });

  it('falls back to Azure’s syllables when its sounds do not line up, if it scored beat by beat', () => {
    const words = nameJapanese([word('ください', [100, 100, 100, 100, 100, 100, 80, 75], [100, 100, 100, 77])], parseJa('ください').ja);
    expect(words[0].phonemes.map((p) => p.score)).toEqual([100, 100, 100, 77]);
    expect(words[0].phonemes[1].phoneme).toBe('ja:voiced'); // だ
  });

  it('names nothing when neither lines up — never a guessed name', () => {
    const words = [word('おちゃ', [93, 100, 100, 100], [99])];
    expect(nameJapanese(words, parseJa('お{茶|ちゃ}').ja)).toBe(words);
  });
});

describe('the Japanese course', () => {
  it('is written entirely in kana the model can read: no character is skipped', () => {
    for (const it of JA_ITEMS) {
      const beats = morae(it.ja!.kana).map((m) => m.kana).join('');
      expect(beats, it.text).toBe(it.ja!.kana.replace(/[\s、。！？!?,.・]/gu, ''));
      expect(it.ja!.romaji, it.text).not.toBe('');
      expect(it.lang).toBe('ja-JP');
    }
  });

  it('never gives two different lines the same id', () => {
    const byId = new Map<string, string>();
    for (const it of JA_ITEMS) {
      expect(byId.get(it.id) ?? it.text, it.id).toBe(it.text);
      byId.set(it.id, it.text);
    }
  });

  it('has seven lessons for every age, like the other courses', () => {
    const unit = JA_COURSE.units[0];
    expect(unit.lessons).toHaveLength(7);
    for (const l of unit.lessons) {
      expect(findLesson(l.id)).toBe(l);
      for (const band of ['little', 'junior', 'teen'] as const) expect(l.exercises[band].length, `${l.id} ${band}`).toBeGreaterThan(0);
    }
    for (const band of ['little', 'junior', 'teen'] as const) expect(JA_CHECK_ITEMS[band].length).toBeGreaterThan(0);
  });

  it('teaches nine sounds, each with a guide and a full Lab ladder', () => {
    expect(JA_LAB_SOUNDS).toHaveLength(9);
    expect(new Set(JA_SOUNDS.map((s) => s.id))).toEqual(new Set(JA_LAB_SOUNDS));
    for (const id of JA_LAB_SOUNDS) {
      expect(phonemeInfo(id).name, id).not.toBe(id);
      const ladder = JA_LADDERS[id];
      for (const stage of ['syllables', 'words', 'phrases', 'sentence'] as const) expect(ladder[stage].length, `${id} ${stage}`).toBeGreaterThan(0);
    }
  });

  it('only names beats as sounds the catalogue has', () => {
    const known = new Set(JA_LAB_SOUNDS);
    for (const it of JA_ITEMS) for (const m of morae(it.ja!.kana)) if (m.unit) expect(known.has(m.unit), `${it.text} ${m.kana}`).toBe(true);
  });
});
