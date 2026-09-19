import { describe, expect, it } from 'vitest';
import type { ChildProfile } from '../domain/types';
import { emptyProfile } from '../intelligence/profile';
import { splitSentences } from '../speech/read';
import { sayItem } from '../features/say/sayItem';

const learner = (weak: Record<string, number> = {}): ChildProfile => {
  const pron = emptyProfile();
  for (const [phoneme, ema] of Object.entries(weak)) pron.phonemes[phoneme] = { phoneme, count: 6, ema, first: ema, best: ema, last: ema, substitutions: {}, days: [] } as never;
  return { id: 'p', name: 'Tiger', age: 9, band: 'junior', accent: 'en-US', zhScript: 'hant', homeLanguage: 'yue', pronunciation: pron } as unknown as ChildProfile;
};

describe('Say it right', () => {
  it('splits typed English into sentences it can score', () => {
    expect(splitSentences('The cat sat on the mat.  It was a very long day!  "Is this for me?" she asked.'))
      .toEqual(['The cat sat on the mat.', 'It was a very long day!', '"Is this for me?" she asked.']);
    expect(splitSentences('Dr. Who is here')).toEqual(['Dr. Who is here']);
    const long = `${'word '.repeat(60)}end.`;
    expect(splitSentences(long).every((s) => s.length <= 160)).toBe(true);
  });

  it('turns an English sentence into a practice item that checks the learner\'s own weak sounds', () => {
    const it = sayItem({ text: 'I think the red apple is very good.' }, learner({ 'θ': 50, v: 60, 'ʃ': 40 }))!;
    expect(it.kind).toBe('sentence');
    expect(it.lang).toBeUndefined();
    expect(it.focus).toEqual(['θ', 'v']); // ʃ is weak too, but not in this sentence
    expect(it.id).toMatch(/^say:/);
  });

  it('only practises Chinese lines whose pinyin was checked, scoring the Simplified text', () => {
    const it = sayItem({ text: '這個蘋果很好吃！', traditional: '這個蘋果很好吃！', simplified: '这个苹果很好吃！', pinyin: 'zhe4 ge4 ping2 guo3 hen3 hao3 chi1' }, learner({ 'zh:t3': 40 }))!;
    expect(it).toMatchObject({ text: '这个苹果很好吃！', lang: 'zh-CN', zh: { hant: '這個蘋果很好吃！', py: 'zhe4 ge4 ping2 guo3 hen3 hao3 chi1' }, kind: 'sentence', focus: ['zh:t3'] });
    expect(sayItem({ text: '這個蘋果很好吃！' }, learner())).toBeNull();
  });
});
