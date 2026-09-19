import { joinSyllable, parseSyllable } from './pinyin';

// "What did it sound like instead?" for Mandarin.
//
// The scorer grades a take against the text it is given, and it is lenient about some of the very confusions Hong
// Kong children make (诗 shī read as 丝 sī scored 88 in the live probe). So for a syllable at risk we also score the
// same audio against the likely mistake, spelled with a real character that has exactly that reading. If the
// mistake fits the audio better than the target, that is what the child said. These characters are chosen for a
// single, unambiguous reading; eval/ checks each one against the scorer's own pinyin.

/** Numbered pinyin (ü written as v) → a common character with exactly that reading. */
export const CHAR_FOR: Record<string, string> = {
  // curled (zh ch sh) → flat (z c s)
  sui3: '髓', si1: '思', si4: '四', su1: '苏', san1: '三', ci1: '疵', cun1: '村', cu1: '粗', zi1: '资', zao3: '早', zu1: '租',
  // flat → curled, for learners who over-correct
  shi1: '诗', shi4: '是', shu1: '书', shan1: '山', chi1: '吃', zhi1: '知', zhao3: '找',
  // n ↔ l
  li3: '李', liu2: '流', lv3: '旅', lan2: '蓝', lian2: '连', ni4: '逆', ni3: '你', nin2: '您', nan2: '男', nao3: '脑', niu2: '牛', lou4: '漏',
  // -ng ↔ -n
  tan1: '贪', tan2: '谈', xian3: '显', xian1: '先', pin2: '贫', bin1: '宾', fang4: '放', dang4: '荡', jiang4: '酱', kang4: '抗',
  lang2: '狼', shang1: '伤', sheng2: '绳', ling2: '灵', tang1: '汤', tang2: '糖', xiang3: '想', xiang1: '香', ping2: '平', bing1: '冰',
  fan4: '饭', dan4: '蛋', jian4: '见', kan4: '看', shen2: '神', lin2: '林',
  // ü → i / u
  yi2: '姨', yi3: '椅', li4: '力', qi4: '气', xie2: '鞋', nu3: '努', lu4: '路',
  // h → f
  fu3: '府',
};

export interface Alternative {
  /** Numbered pinyin of the likely mistake. */
  py: string;
  char: string;
  /** Which part of the syllable the mistake is in. */
  part: 'initial' | 'final';
}

const INITIAL_SWAPS: Record<string, string[]> = { zh: ['z'], ch: ['c'], sh: ['s'], z: ['zh'], c: ['ch'], s: ['sh'], n: ['l'], l: ['n'], r: ['l'], h: ['f'] };
const FINAL_SWAPS: Record<string, string[]> = {
  ang: ['an'], an: ['ang'], eng: ['en'], en: ['eng'], ing: ['in'], in: ['ing'], iang: ['ian'], ian: ['iang'], uang: ['uan'], uan: ['uang'],
  'ü': ['i', 'u'], 'üe': ['ie'], 'ün': ['in'], 'üan': ['ian'],
};

/** The server re-scores a take at most this many times (each re-scoring is billed). */
export const MAX_ALTERNATIVES = 5;

const UNIT_OF_PART = (py: string, part: Alternative['part']): string => {
  const s = parseSyllable(py);
  if (part === 'initial') return /^(zh|ch|sh|r)$/.test(s.initial) ? 'zh:sh' : /^[zcs]$/.test(s.initial) ? 'zh:s' : /^[nl]$/.test(s.initial) ? 'zh:n' : 'zh:other';
  return s.final.startsWith('ü') ? 'zh:ü' : 'zh:-ng';
};

/**
 * Which likely mistakes to score a whole item against: the same text with ONE character swapped for its likely
 * mistake. Sounds the item practises come first; curled-tongue and n/l slips (the commonest for Hong Kong children)
 * before endings.
 */
export const alternativeRequests = (text: string, py: string, focus: string[] = []): (Alternative & { index: number; text: string })[] => {
  const syllables = py.trim().split(/\s+/);
  const all = syllables.flatMap((s, index) => alternativesFor(s).map((a) => ({ ...a, index, unit: UNIT_OF_PART(s, a.part) })));
  const rank = (a: (typeof all)[number]) => (focus.includes(a.unit) ? 0 : 10) + (a.part === 'initial' ? 0 : 5) + a.index * 0.01;
  return all.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_ALTERNATIVES).map(({ unit: _unit, ...a }) => {
    let k = -1;
    const swapped = [...text].map((ch) => (/\p{Script=Han}/u.test(ch) && ++k === a.index ? a.char : ch)).join('');
    return { ...a, text: swapped };
  });
};

/** Likely mistakes for one syllable that we can actually test (a character exists for them). */
export const alternativesFor = (numbered: string): Alternative[] => {
  const s = parseSyllable(numbered);
  if (s.tone === 5) return [];
  const out: Alternative[] = [];
  const add = (py: string | null, part: Alternative['part']) => {
    if (!py) return;
    const key = py.replace(/ü/g, 'v');
    const char = CHAR_FOR[key];
    if (char && key !== numbered.replace(/ü/g, 'v') && !out.some((a) => a.py === key)) out.push({ py: key, char, part });
  };
  for (const i of INITIAL_SWAPS[s.initial] ?? []) {
    // A flat z/c/s before -i is its own "buzzing" vowel, the same symbol after zh/ch/sh.
    add(joinSyllable(i, s.final, s.tone), 'initial');
  }
  for (const f of FINAL_SWAPS[s.final] ?? []) {
    if (f === 'u' && !/^[nl]$/.test(s.initial)) continue; // ü → u is only a real confusion after n and l
    add(joinSyllable(s.initial, f, s.tone), 'final');
  }
  return out;
};
