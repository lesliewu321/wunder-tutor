import { describe, expect, it } from 'vitest';
import { applyPinyin, checkChineseLine, cleanLines, pageLanguage, pinyinBatches, readText, upstreamError } from './read.mjs';

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

  it('mends a syllable that does not exist when the tone gives the reading away: 得 de3 → dei3', () => {
    expect(checkChineseLine({ text: '我得走了。', chars: chars([['我', '我', 'wo3'], ['得', '得', 'de3'], ['走', '走', 'zou3'], ['了', '了', 'le5']]) }).pinyin).toBe('wo3 dei3 zou3 le5');
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
    expect(cleanLines({ lines: Array.from({ length: 80 }, (_, i) => ({ text: `Line ${i}.`, lang: 'en' })) }).length).toBe(40);
    expect(pageLanguage(cleanLines({ lines: [] }))).toBe('none');
    expect(pageLanguage(cleanLines(null))).toBe('none');
  });

  it('gives every sentence its own language, so a bilingual page (a Hong Kong menu) is kept', () => {
    const lines = cleanLines({ lines: [
      { text: 'Fried rice', lang: 'en' }, { text: '炒飯', lang: 'zh' }, { text: 'Bon appétit !', lang: 'other' }, { text: 'Tea', lang: 'klingon' },
    ] });
    applyPinyin([lines[1]], { sentences: [{ n: 1, chars: chars([['炒', '炒', 'chao3'], ['飯', '饭', 'fan4']]) }] });
    expect(pageLanguage(lines)).toBe('zh');
    expect(lines).toEqual([
      { text: 'Fried rice', lang: 'en' },
      { text: '炒飯', lang: 'zh', traditional: '炒飯', simplified: '炒饭', pinyin: 'chao3 fan4' },
      { text: 'Bon appétit !', lang: 'other' },
      { text: 'Tea', lang: 'en' },
    ]);
    // Nothing in English or Chinese: the page is turned away as a whole.
    expect(pageLanguage(cleanLines({ lines: [{ text: 'Merci beaucoup.', lang: 'other' }] }))).toBe('other');
  });

  it('never gives pinyin to a line with kana among the characters', () => {
    const [jp] = cleanLines({ lines: [{ text: '私は学生です。', lang: 'zh' }] });
    applyPinyin([jp], { sentences: [{ n: 1, chars: chars([['私', '私', 'si1'], ['學', '学', 'xue2'], ['生', '生', 'sheng1']]) }] });
    expect(jp.pinyin).toBeUndefined();
  });

  it('asks for the pinyin of a long page in at most 6 requests, in order', () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ text: `${'我'.repeat(20)}${i}`, lang: 'zh' }));
    const batches = pinyinBatches(lines);
    expect(batches.length).toBeLessThanOrEqual(6);
    expect(batches.flat()).toEqual(lines);
    expect(pinyinBatches([{ text: '你好', lang: 'zh' }])).toEqual([[{ text: '你好', lang: 'zh' }]]);
  });
});

const answer = (json, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: json }] }, finishReason }] }));

describe('reading in two steps', () => {
  it('finds the sentences, then asks for the pinyin; a failed pinyin request gets one more try', async () => {
    const asked = [];
    let pinyinTries = 0;
    const fetchImpl = async (_url, init) => {
      const schema = JSON.parse(init.body).generationConfig.responseSchema;
      asked.push(Object.keys(schema.properties)[0]);
      if (schema.properties.lines) return answer(JSON.stringify({ lines: [{ text: 'Hello!', lang: 'en' }, { text: '你好。', lang: 'zh' }] }));
      if (++pinyinTries === 1) return new Response('{"error":"busy"}', { status: 503 });
      return answer(JSON.stringify({ sentences: [{ n: 1, chars: chars([['你', '你', 'ni3'], ['好', '好', 'hao3']]) }] }));
    };
    const r = await readText({ apiKey: 'k', text: 'Hello!\n你好。', fetchImpl });
    expect(asked).toEqual(['lines', 'sentences', 'sentences']);
    expect(r).toEqual({ language: 'zh', lines: [{ text: 'Hello!', lang: 'en' }, { text: '你好。', lang: 'zh', traditional: '你好。', simplified: '你好。', pinyin: 'ni3 hao3' }] });
  });

  it('says why an answer could not be used (a cut-off answer)', async () => {
    await expect(readText({ apiKey: 'k', text: 'x', fetchImpl: async () => answer('{"lines": [', 'MAX_TOKENS') }))
      .rejects.toMatchObject({ status: 424, body: { error: 'read_unparseable', finish: 'MAX_TOKENS' } });
  });

  it('names why Google refused, and keeps its words for the log only', () => {
    const where = upstreamError(400, JSON.stringify({ error: { code: 400, message: 'User location is not supported for the API use.', status: 'FAILED_PRECONDITION' } }));
    expect(where).toMatchObject({ status: 424, body: { error: 'read_region', status: 400 } });
    expect(where.upstreamMessage).toBe('User location is not supported for the API use.');
    expect(JSON.stringify(where.body)).not.toContain('location');
    expect(upstreamError(400, JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } })).body.error).toBe('read_key');
    expect(upstreamError(404, '{}').body.error).toBe('read_model');
    expect(upstreamError(500, 'oops').body.error).toBe('read_upstream');
  });
});
