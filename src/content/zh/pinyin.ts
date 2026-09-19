// Pinyin: parsing, tone marks and tone sandhi for the Mandarin (Putonghua) course.
//
// Content stores pinyin with tone NUMBERS, one syllable per character ("wo3 xiang3 he1 shui3"), with 5 for the
// neutral tone. Numbers are what the scorer and the tone checker work with; tone MARKS are only for display.

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface Syllable {
  /** Toneless pinyin as written, e.g. "shui", "lv" normalised to "lü". */
  base: string;
  tone: Tone;
  /** Phonological initial ('' for zero-initial syllables such as "ai" or "yi"). */
  initial: string;
  /** Phonological final with y/w/ü spelling rules undone: "yu" → "ü", "shui" → "uei", "zhi" → "-i". */
  final: string;
}

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's'];

/** y/w spellings of zero-initial syllables → the final they stand for. */
const ZERO: Record<string, string> = {
  yi: 'i', ya: 'ia', yan: 'ian', yang: 'iang', yao: 'iao', ye: 'ie', you: 'iou', yong: 'iong', yin: 'in', ying: 'ing',
  yu: 'ü', yue: 'üe', yuan: 'üan', yun: 'ün', yo: 'io',
  wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'uei', wan: 'uan', wen: 'uen', wang: 'uang', weng: 'ueng',
};

const norm = (s: string) => s.toLowerCase().replace(/u:|v/g, 'ü');

/** "shui3" → { base: "shui", tone: 3, initial: "sh", final: "uei" }. Throws on anything that isn't pinyin. */
export const parseSyllable = (numbered: string): Syllable => {
  const m = /^([a-zü:]+)([1-5])$/i.exec(norm(numbered).trim());
  if (!m) throw new Error(`not a numbered pinyin syllable: "${numbered}"`);
  const base = m[1];
  const tone = Number(m[2]) as Tone;
  if (ZERO[base]) return { base, tone, initial: '', final: ZERO[base] };
  if (/^(a|o|e|ai|ei|ao|ou|an|en|ang|eng|er)$/.test(base)) return { base, tone, initial: '', final: base };
  const initial = INITIALS.find((i) => base.startsWith(i));
  if (!initial) throw new Error(`unknown initial in "${numbered}"`);
  let final = base.slice(initial.length);
  if (!final) throw new Error(`missing final in "${numbered}"`);
  if (final === 'i' && /^(zh|ch|sh|r|z|c|s)$/.test(initial)) final = '-i'; // the buzzing "vowel" of zhi/chi/shi/ri/zi/ci/si
  else if (/^[jqx]$/.test(initial) && final.startsWith('u')) final = 'ü' + final.slice(1); // ju = jü
  else if (final === 'ui') final = 'uei';
  else if (final === 'iu') final = 'iou';
  else if (final === 'un') final = 'uen';
  return { base, tone, initial, final };
};

export const splitPinyin = (py: string): string[] => py.trim().split(/\s+/).filter(Boolean);

// ------------------------------------------------------------------ display

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'], i: ['ī', 'í', 'ǐ', 'ì'], o: ['ō', 'ó', 'ǒ', 'ò'], u: ['ū', 'ú', 'ǔ', 'ù'], ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/** "shui3" → "shuǐ", "lv4" → "lǜ", "le5" → "le". */
export const markSyllable = (numbered: string): string => {
  const { base, tone } = parseSyllable(numbered);
  const written = base; // already "ü"-normalised
  if (tone === 5) return written;
  // a or e takes the mark; in "ou" the o does; otherwise the last vowel (so "iu" → u, "ui" → i).
  let idx = written.search(/[ae]/);
  if (idx < 0) idx = written.indexOf('ou');
  if (idx < 0) {
    for (let i = written.length - 1; i >= 0; i--) if ('iouü'.includes(written[i])) { idx = i; break; }
  }
  if (idx < 0) return written;
  const v = written[idx];
  return written.slice(0, idx) + MARKS[v][tone - 1] + written.slice(idx + 1);
};

export const markPinyin = (py: string): string[] => splitPinyin(py).map(markSyllable);

// ------------------------------------------------------------------ tone sandhi

export interface SurfaceTone {
  /** Tone of the character in the dictionary. */
  citation: Tone;
  /** Tones a native speaker would actually use here, best first. 5 = neutral (not assessed). */
  accept: Tone[];
  /** A 3rd tone that isn't at the end of a phrase is said low ("half third"), without the final rise. */
  lowThird: boolean;
}

/**
 * Tones as spoken, from citation tones. `chars` are the characters (for 一 and 不); `breaks` marks positions that
 * end a phrase (punctuation), after which sandhi does not carry across.
 *  - 一 yī: yí before a 4th tone, yì before 1st/2nd/3rd; yī at the end.
 *  - 不 bù: bú before a 4th tone.
 *  - 3rd + 3rd: in a run of 3rd tones the one before the last becomes 2nd; earlier ones may be 2nd or a low 3rd.
 */
export const surfaceTones = (citation: Tone[], chars: string[] = [], breaks: Set<number> = new Set()): SurfaceTone[] => {
  const n = citation.length;
  const tones = [...citation];
  const endsPhrase = (i: number) => i === n - 1 || breaks.has(i);
  for (let i = 0; i < n; i++) {
    const next = endsPhrase(i) ? undefined : citation[i + 1];
    if (chars[i] === '一' && citation[i] === 1 && next) tones[i] = next === 4 ? 2 : next === 5 ? 1 : 4;
    if (chars[i] === '不' && citation[i] === 4 && next === 4) tones[i] = 2;
  }
  const out: SurfaceTone[] = tones.map((t, i) => ({ citation: citation[i], accept: [t], lowThird: t === 3 && !endsPhrase(i) }));
  // 3rd-tone runs (neutral tones and phrase ends break a run).
  let i = 0;
  while (i < n) {
    if (tones[i] !== 3) { i++; continue; }
    let j = i;
    while (j + 1 < n && tones[j + 1] === 3 && !endsPhrase(j)) j++;
    if (j > i) {
      for (let k = i; k < j; k++) out[k] = { citation: citation[k], accept: k === j - 1 ? [2] : [2, 3], lowThird: false };
      out[j] = { ...out[j], accept: [3] };
    }
    i = j + 1;
  }
  return out;
};

// ------------------------------------------------------------------ what Hong Kong children find hard

/** Segment confusions a Cantonese speaker commonly makes in Putonghua, as (initial or final) → what tends to come out. */
export const CANTONESE_ZH: { initials: Record<string, string>; finals: Record<string, string> } = {
  initials: { zh: 'z', ch: 'c', sh: 's', r: 'l', n: 'l', j: 'z', q: 'c', x: 's', h: 'f' },
  finals: { 'ü': 'i', 'üe': 'ie', 'ün': 'in', 'üan': 'ian', ing: 'in', eng: 'en', ang: 'an', iang: 'ian', uang: 'uan', e: 'o', er: 'e' },
};

/** Build a numbered syllable from parts (inverse of parseSyllable for ordinary syllables). */
export const joinSyllable = (initial: string, final: string, tone: Tone): string | null => {
  let f = final;
  if (!initial) {
    const zero = Object.entries(ZERO).find(([, v]) => v === final)?.[0];
    return `${zero ?? final}${tone}`.replace(/ü/g, 'v');
  }
  // j q x only combine with i- and ü- finals; z c s / zh ch sh r only with -i, never plain i.
  if (/^[jqx]$/.test(initial) && !/^[iü]/.test(final)) return null;
  if (/^(zh|ch|sh|r|z|c|s)$/.test(initial) && /^(i|ü)/.test(final)) return null;
  if (f === '-i') f = 'i';
  else if (f === 'uei') f = 'ui';
  else if (f === 'iou') f = 'iu';
  else if (f === 'uen') f = 'un';
  if (/^[jqx]$/.test(initial)) f = f.replace(/^ü/, 'u');
  return `${initial}${f}${tone}`.replace(/ü/g, 'v');
};
