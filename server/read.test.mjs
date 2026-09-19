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

  it('writes numbers out as they are read, and leaves Latin letters out', () => {
    const r = checkChineseLine({ text: '我有3個蘋果和iPad。', chars: chars([['我', '我', 'wo3'], ['有', '有', 'you3'], ['三', '三', 'san1'], ['個', '个', 'ge4'], ['蘋', '苹', 'ping2'], ['果', '果', 'guo3'], ['和', '和', 'he2']]) });
    expect(r.simplified).toBe('我有三个苹果和。');
    expect(r.pinyin).toBe('wo3 you3 san1 ge4 ping2 guo3 he2');
  });

  it('keeps the answer to a sensible size', () => {
    const r = cleanReading({ language: 'en', lines: Array.from({ length: 80 }, (_, i) => ({ text: `Line ${i}.` })) });
    expect(r.lines.length).toBe(40);
    expect(cleanReading({ language: 'klingon', lines: [{ text: 'x' }] }).language).toBe('none');
  });
});
