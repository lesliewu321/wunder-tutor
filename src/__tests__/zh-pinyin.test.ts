import { describe, expect, it } from 'vitest';
import { markPinyin, markSyllable, parseSyllable, surfaceTones, type Tone } from '../content/zh/pinyin';
import { alternativesFor, CHAR_FOR } from '../content/zh/alternatives';
import { ZH_ITEMS } from '../content/zh/course';

const tones = (py: string) => py.split(' ').map((s) => Number(s.slice(-1)) as Tone);
const chars = (hans: string) => [...hans].filter((c) => /\p{Script=Han}/u.test(c));
const accept = (hans: string, py: string) => surfaceTones(tones(py), chars(hans)).map((t) => t.accept.join('|'));

describe('pinyin', () => {
  it('parses syllables into initial, final and tone, undoing spelling rules', () => {
    expect(parseSyllable('shui3')).toMatchObject({ initial: 'sh', final: 'uei', tone: 3 });
    expect(parseSyllable('yu2')).toMatchObject({ initial: '', final: 'ü', tone: 2 });
    expect(parseSyllable('qu4')).toMatchObject({ initial: 'q', final: 'ü' });
    expect(parseSyllable('lv4')).toMatchObject({ initial: 'l', final: 'ü' });
    expect(parseSyllable('shi4')).toMatchObject({ initial: 'sh', final: '-i' });
    expect(parseSyllable('niu2')).toMatchObject({ initial: 'n', final: 'iou' });
    expect(parseSyllable('wo3')).toMatchObject({ initial: '', final: 'uo' });
    expect(parseSyllable('le5').tone).toBe(5);
  });

  it('puts tone marks where pinyin puts them', () => {
    expect(markSyllable('shui3')).toBe('shuǐ');
    expect(markSyllable('niu2')).toBe('niú');
    expect(markSyllable('lv4')).toBe('lǜ');
    expect(markSyllable('xiang1')).toBe('xiāng');
    expect(markSyllable('gou3')).toBe('gǒu');
    expect(markSyllable('xie5')).toBe('xie');
    expect(markPinyin('wo3 xi3 huan5 chi1 yu2')).toEqual(['wǒ', 'xǐ', 'huan', 'chī', 'yú']);
  });
});

describe('tone sandhi', () => {
  it('3rd + 3rd → 2nd + 3rd', () => {
    expect(accept('你好', 'ni3 hao3')).toEqual(['2', '3']);
    expect(accept('我想喝水', 'wo3 xiang3 he1 shui3')).toEqual(['2', '3', '1', '3']);
  });
  it('runs of 3rd tones: the one before the last is 2nd, earlier ones may stay low', () => {
    expect(accept('请给我一杯水', 'qing3 gei3 wo3 yi1 bei1 shui3')).toEqual(['2|3', '2', '3', '4', '1', '3']);
  });
  it('一 and 不 change before other tones', () => {
    expect(accept('一杯', 'yi1 bei1')).toEqual(['4', '1']);
    expect(accept('不客气', 'bu4 ke4 qi5')).toEqual(['2', '4', '5']);
    expect(accept('我不饿', 'wo3 bu4 e4')).toEqual(['3', '2', '4']);
  });
  it('a 3rd tone followed by more speech is low; at the end it keeps its rise', () => {
    const s = surfaceTones(tones('wo3 e4 le5'), chars('我饿了'));
    expect(s[0]).toMatchObject({ accept: [3], lowThird: true });
    expect(surfaceTones([3])[0].lowThird).toBe(false);
  });
  it('punctuation ends a phrase: no sandhi across it', () => {
    // 你好！你想… — the 好 is phrase-final, so 好 and the next 你 don't form a run.
    const s = surfaceTones(tones('ni3 hao3 ni3 xiang3'), chars('你好你想'), new Set([1]));
    expect(s.map((t) => t.accept.join('|'))).toEqual(['2', '3', '2', '3']);
  });
});

describe('likely-mistake alternatives', () => {
  it('offers the flat-tongue twin of a curled sound, and the -n twin of an -ng', () => {
    expect(alternativesFor('shi4').map((a) => a.char)).toEqual(['四']);
    expect(alternativesFor('shi1').map((a) => a.char)).toEqual(['思']);
    expect(alternativesFor('tang1').map((a) => `${a.part}:${a.char}`)).toEqual(['final:贪']);
    expect(alternativesFor('nv3').map((a) => a.char)).toEqual(['旅', '你', '努']);
    expect(alternativesFor('le5')).toEqual([]);
  });
  it('every alternative character is a single Han character', () => {
    for (const c of Object.values(CHAR_FOR)) expect([...c]).toHaveLength(1);
  });
});

describe('Mandarin course content', () => {
  it('has one pinyin syllable per character and parses cleanly', () => {
    for (const it of ZH_ITEMS) {
      const py = it.zh!.py.split(' ');
      expect(chars(it.text)).toHaveLength(py.length);
      expect(chars(it.zh!.hant)).toHaveLength(py.length);
      for (const s of py) expect(() => parseSyllable(s)).not.toThrow();
    }
  });
  it('item ids are unique', () => {
    const ids = ZH_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
