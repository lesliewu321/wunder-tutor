import { describe, expect, it } from 'vitest';
import { checkChineseLine, cleanReading } from './read.mjs';

const chars = (spec) => spec.map(([t, s, py]) => ({ t, s, py }));

describe('reading text for practice', () => {
  it('accepts a Chinese line only when its characters and pinyin agree with the text', () => {
    const ok = checkChineseLine({ text: '這個蘋果很好吃！', chars: chars([['這', '这', 'zhe4'], ['個', '个', 'ge4'], ['蘋', '苹', 'ping2'], ['果', '果', 'guo3'], ['很', '很', 'hen3'], ['好', '好', 'hao3'], ['吃', '吃', 'chi1']]) });
    expect(ok).toEqual({ text: '這個蘋果很好吃！', traditional: '這個蘋果很好吃！', simplified: '这个苹果很好吃！', pinyin: 'zhe4 ge4 ping2 guo3 hen3 hao3 chi1' });
    // A missing character, a bad syllable, or a character that isn't in the text: no pinyin, not practised.
    expect(checkChineseLine({ text: '我想喝水。', chars: chars([['我', '我', 'wo3'], ['想', '想', 'xiang3']]) }).pinyin).toBeUndefined();
    expect(checkChineseLine({ text: '我想', chars: chars([['我', '我', 'wo3'], ['想', '想', 'xiang']]) }).pinyin).toBeUndefined();
    expect(checkChineseLine({ text: '我想', chars: chars([['你', '你', 'ni3'], ['想', '想', 'xiang3']]) }).pinyin).toBeUndefined();
  });

  it('writes numbers out as they are read', () => {
    const r = checkChineseLine({ text: '我有3個蘋果。', chars: chars([['我', '我', 'wo3'], ['有', '有', 'you3'], ['三', '三', 'san1'], ['個', '个', 'ge4'], ['蘋', '苹', 'ping2'], ['果', '果', 'guo3']]) });
    expect(r.simplified).toBe('我有三个苹果。');
    expect(r.pinyin).toBe('wo3 you3 san1 ge4 ping2 guo3');
  });

  it('does not offer lines it cannot score fairly: mixed with English, or syllables without a vowel', () => {
    // "我喜欢 Peppa Pig！" — scoring only the Chinese would quietly drop the English words.
    expect(checkChineseLine({ text: '我喜歡Peppa Pig！', chars: chars([['我', '我', 'wo3'], ['喜', '喜', 'xi3'], ['歡', '欢', 'huan5']]) }).pinyin).toBeUndefined();
    // 嗯 read "n2" (and 儿 as "r5") can't be checked syllable by syllable.
    expect(checkChineseLine({ text: '嗯，好的。', chars: chars([['嗯', '嗯', 'n2'], ['好', '好', 'hao3'], ['的', '的', 'de5']]) }).pinyin).toBeUndefined();
  });

  it('keeps the answer to a sensible size', () => {
    const r = cleanReading({ lines: Array.from({ length: 80 }, (_, i) => ({ text: `Line ${i}.`, lang: 'en' })) });
    expect(r.lines.length).toBe(40);
    expect(cleanReading({ lines: [] }).language).toBe('none');
    expect(cleanReading(null).language).toBe('none');
  });

  it('gives every sentence its own language, so a bilingual page (a Hong Kong menu) is kept', () => {
    const r = cleanReading({ lines: [
      { text: 'Fried rice', lang: 'en' },
      { text: '炒飯', lang: 'zh', chars: chars([['炒', '炒', 'chao3'], ['飯', '饭', 'fan4']]) },
      { text: 'Bon appétit !', lang: 'other' },
      { text: 'Tea', lang: 'klingon' },
    ] });
    expect(r.language).toBe('zh');
    expect(r.lines).toEqual([
      { text: 'Fried rice', lang: 'en' },
      { text: '炒飯', traditional: '炒飯', simplified: '炒饭', pinyin: 'chao3 fan4', lang: 'zh' },
      { text: 'Bon appétit !', lang: 'other' },
      { text: 'Tea', lang: 'en' },
    ]);
    // Nothing in English or Chinese: the page is turned away as a whole.
    expect(cleanReading({ lines: [{ text: 'Merci beaucoup.', lang: 'other' }] }).language).toBe('other');
  });

  it('never gives pinyin to a line in another language, or with kana among the characters', () => {
    const jp = { text: '私は学生です。', chars: chars([['私', '私', 'si1'], ['學', '学', 'xue2'], ['生', '生', 'sheng1']]) };
    expect(cleanReading({ lines: [{ ...jp, lang: 'other' }] }).lines[0]).toEqual({ text: jp.text, lang: 'other' });
    expect(cleanReading({ lines: [{ ...jp, lang: 'zh' }] }).lines[0].pinyin).toBeUndefined();
  });
});
