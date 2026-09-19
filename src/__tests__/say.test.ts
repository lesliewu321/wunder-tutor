import { describe, expect, it } from 'vitest';
import type { ChildProfile } from '../domain/types';
import { emptyProfile } from '../intelligence/profile';
import { splitSentences } from '../speech/read';
import { sayItem } from '../features/say/sayItem';
import { writtenWords } from '../tutor/feedback';
import { backLenses, pickLens } from '../features/say/camera';

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

describe('Say it right — lines it cannot check', () => {
  it('never throws: a syllable the parser rejects just makes the line "can\'t check"', () => {
    expect(sayItem({ text: '嗯，好的。', traditional: '嗯，好的。', simplified: '嗯，好的。', pinyin: 'n2 hao3 de5' }, learner())).toBeNull();
  });
  it('practises English only when the reader says the sentence is English', () => {
    expect(sayItem({ text: 'Fried rice', lang: 'en' }, learner())).not.toBeNull();
    expect(sayItem({ text: 'Bon appétit !', lang: 'other' }, learner())).toBeNull();
    expect(sayItem({ text: 'ni hao', lang: 'zh' }, learner())).toBeNull(); // pinyin written out: not English
  });
});

describe('Say it right — showing the scores on the words as written', () => {
  const w = (word: string, errorType: 'none' | 'insertion' = 'none') => ({ word, errorType });
  it('keeps capitals and punctuation, skips a dash, and keeps an extra word the scorer heard', () => {
    expect(writtenWords('Mr. Lee — likes 3 cats.', [w('mr'), w('lee'), w('um', 'insertion'), w('likes'), w('three'), w('cats')]))
      .toEqual(['Mr.', 'Lee', 'um', 'likes', '3', 'cats.']);
  });
  it('shows the scorer\'s words when the text can\'t be lined up', () => {
    expect(writtenWords('A well-known song', [w('a'), w('well'), w('known'), w('song')])).toEqual(['a', 'well', 'known', 'song']);
  });
});

describe('Say it right — the camera', () => {
  const android = [
    { deviceId: 'a', label: 'camera2 1, facing front', kind: 'videoinput' },
    { deviceId: 'b', label: 'camera2 3, facing back', kind: 'videoinput' },
    { deviceId: 'c', label: 'camera2 0, facing back', kind: 'videoinput' },
    { deviceId: 'd', label: 'camera2 2, facing back', kind: 'videoinput' },
    { deviceId: 'm', label: 'Microphone', kind: 'audioinput' },
  ];
  it('opens the main back camera, not whichever lens the browser picked first (a zoom lens magnified the page)', () => {
    const backs = backLenses(android);
    expect(backs.map((l) => l.deviceId)).toEqual(['b', 'c', 'd']);
    expect(pickLens(backs)?.deviceId).toBe('c');
    // The lens the learner chose with the Lens button wins while it exists.
    expect(pickLens(backs, 'd')?.deviceId).toBe('d');
    expect(pickLens(backs, 'gone')?.deviceId).toBe('c');
  });
  it('keeps the browser’s choice where lenses have other names (iPhone, computers)', () => {
    const iphone = [{ deviceId: 'x', label: 'Back Camera' }, { deviceId: 'y', label: 'Back Ultra Wide Camera' }, { deviceId: 'z', label: '前置相機' }];
    expect(backLenses(iphone).map((l) => l.deviceId)).toEqual(['x', 'y']);
    expect(pickLens(backLenses(iphone))).toBeNull();
    expect(backLenses([{ deviceId: 'w', label: 'HD WebCam (04f2:b6dd)' }])).toEqual([]);
  });
});
