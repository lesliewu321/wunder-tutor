import type { JaText, PhonemeId } from '../../domain/types';

// Japanese as it is spoken: a string of morae — beats of equal length. こんにちは is five beats (ko-n-ni-chi-wa), and
// the beats a learner loses are exactly the ones this course teaches: the second half of a long vowel (おばあさん has
// five, おばさん four, and they are grandma and aunt), the small っ (きって, stamp, is three beats; きて, come, two), and
// ん, which is a beat of its own. Everything here works from the kana reading, which is exact; spelling to sound is
// regular in kana, so unlike French nothing needs a hand-written lexicon — only the reading of each kanji, which every
// item carries (see `parseJa`).
//
// Two models of the same beats come out of here:
//   * for people: Hepburn romaji with long vowels marked (arigatō, rāmen), printed under the Japanese;
//   * for the scorer: the sounds of each beat, which is what lets Azure's per-sound scores (it names none of them for
//     Japanese) be lined up with beats — see `phoneCandidates` and src/speech/ja/assess.ts.

export interface Mora {
  /** The kana as written (katakana stays katakana; きゃ is one beat written with two kana). */
  kana: string;
  /** Consonant sounds at the start of the beat: [] for a bare vowel, ['k', 'y'] for きゃ, ['Q'] for っ, ['N'] for ん. */
  onset: string[];
  /** The vowel, or '' for っ and ん. A long vowel's second beat repeats the vowel it lengthens. */
  vowel: string;
  /** The second half of a long vowel (ー, or あ after か, う after お…). */
  long?: boolean;
  /** Romaji for this beat alone; a long beat is '' because it becomes the macron on the beat before. */
  romaji: string;
  /** The sound this beat is taught as, when it is one of the nine (ja/sounds.ts). */
  unit?: PhonemeId;
}

const toHiragana = (s: string): string => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** One kana → consonant and vowel. し, ち, つ, ふ, じ are their own consonants (sh, ch, ts, f, j), as Hepburn writes them. */
const BASE: Record<string, [string, string]> = {
  あ: ['', 'a'], い: ['', 'i'], う: ['', 'u'], え: ['', 'e'], お: ['', 'o'],
  か: ['k', 'a'], き: ['k', 'i'], く: ['k', 'u'], け: ['k', 'e'], こ: ['k', 'o'],
  が: ['g', 'a'], ぎ: ['g', 'i'], ぐ: ['g', 'u'], げ: ['g', 'e'], ご: ['g', 'o'],
  さ: ['s', 'a'], し: ['sh', 'i'], す: ['s', 'u'], せ: ['s', 'e'], そ: ['s', 'o'],
  ざ: ['z', 'a'], じ: ['j', 'i'], ず: ['z', 'u'], ぜ: ['z', 'e'], ぞ: ['z', 'o'],
  た: ['t', 'a'], ち: ['ch', 'i'], つ: ['ts', 'u'], て: ['t', 'e'], と: ['t', 'o'],
  だ: ['d', 'a'], ぢ: ['j', 'i'], づ: ['z', 'u'], で: ['d', 'e'], ど: ['d', 'o'],
  な: ['n', 'a'], に: ['n', 'i'], ぬ: ['n', 'u'], ね: ['n', 'e'], の: ['n', 'o'],
  は: ['h', 'a'], ひ: ['h', 'i'], ふ: ['f', 'u'], へ: ['h', 'e'], ほ: ['h', 'o'],
  ば: ['b', 'a'], び: ['b', 'i'], ぶ: ['b', 'u'], べ: ['b', 'e'], ぼ: ['b', 'o'],
  ぱ: ['p', 'a'], ぴ: ['p', 'i'], ぷ: ['p', 'u'], ぺ: ['p', 'e'], ぽ: ['p', 'o'],
  ま: ['m', 'a'], み: ['m', 'i'], む: ['m', 'u'], め: ['m', 'e'], も: ['m', 'o'],
  や: ['y', 'a'], ゆ: ['y', 'u'], よ: ['y', 'o'],
  ら: ['r', 'a'], り: ['r', 'i'], る: ['r', 'u'], れ: ['r', 'e'], ろ: ['r', 'o'],
  わ: ['w', 'a'], を: ['', 'o'], ゔ: ['v', 'u'],
};
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
/** Consonants that already carry the y (しゃ is sha, not shya). */
const PALATAL = new Set(['sh', 'ch', 'j']);
const MACRON: Record<string, string> = { a: 'ā', u: 'ū', e: 'ē', o: 'ō' };

/** The taught sound a beat belongs to. Order matters: りょ is taught as the r, ぎゅ as a voiced sound. */
const unitOf = (m: Pick<Mora, 'onset' | 'vowel' | 'long'>): PhonemeId | undefined => {
  if (m.long) return 'ja:long';
  const [c, glide] = m.onset;
  if (c === 'Q') return 'ja:Q';
  if (c === 'N') return 'ja:N';
  if (c === 'r') return 'ja:r';
  if (c === 'ts') return 'ja:ts';
  if (c === 'f') return 'ja:f';
  if (c === 'z' || c === 'j') return 'ja:z';
  if (c === 'g' || c === 'd' || c === 'b') return 'ja:voiced';
  if (glide === 'y') return 'ja:y';
  return undefined;
};

/** The beats of a kana string. Anything that is not kana (punctuation, spaces) is skipped. */
export const morae = (kana: string): Mora[] => {
  const src = [...toHiragana(kana)];
  const shown = [...kana];
  const out: Mora[] = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const written = shown[i];
    const prev = out[out.length - 1];
    if (c === 'ー') {
      if (prev?.vowel) out.push({ kana: written, onset: [], vowel: prev.vowel, long: true, romaji: '' });
      continue;
    }
    if (c === 'っ') { out.push({ kana: written, onset: ['Q'], vowel: '', romaji: '' }); continue; }
    if (c === 'ん') { out.push({ kana: written, onset: ['N'], vowel: '', romaji: 'n' }); continue; }
    const base = BASE[c];
    if (!base) continue;
    const [cons, vowel] = base;
    const next = src[i + 1];
    let m: Mora;
    if (next && SMALL_Y[next] && vowel === 'i' && cons) {
      m = { kana: written + shown[i + 1], onset: PALATAL.has(cons) ? [cons] : [cons, 'y'], vowel: SMALL_Y[next], romaji: '' };
      i += 1;
    } else if (next && SMALL_V[next]) {
      // Loanword spellings: ファ fa, ティ ti, ディ di, ウィ wi, チェ che, シェ she, ジェ je.
      m = { kana: written + shown[i + 1], onset: [c === 'う' ? 'w' : cons].filter(Boolean), vowel: SMALL_V[next], romaji: '' };
      i += 1;
    } else if (!cons && prev?.vowel && !prev.long && (vowel === prev.vowel || (vowel === 'u' && prev.vowel === 'o'))) {
      // A bare vowel after the same vowel (おばあさん, おおきい) or う after o (がっこう) lengthens it: one long vowel.
      // えい is left as e + i (せんせい, sensei), as Hepburn writes it.
      m = { kana: written, onset: [], vowel: prev.vowel, long: true, romaji: '' };
    } else {
      m = { kana: written, onset: cons ? [cons] : [], vowel, romaji: '' };
    }
    out.push(m);
  }
  // Romaji and taught sounds, now that each beat knows its neighbours.
  for (let i = 0; i < out.length; i++) {
    const m = out[i];
    m.unit = unitOf(m);
    if (m.long) continue;
    if (m.onset[0] === 'Q') {
      const next = out[i + 1];
      const first = next ? consonantRomaji(next.onset) : '';
      m.romaji = first.startsWith('ch') ? 't' : first.charAt(0);
      continue;
    }
    if (m.onset[0] === 'N') {
      const next = out[i + 1];
      m.romaji = next && (!next.onset.length || next.onset[0] === 'y') && !next.long ? "n'" : 'n';
      continue;
    }
    const long = out[i + 1]?.long;
    const v = long ? (m.vowel === 'i' ? 'ii' : MACRON[m.vowel] ?? m.vowel) : m.vowel;
    m.romaji = consonantRomaji(m.onset) + v;
  }
  return out;
};

const consonantRomaji = (onset: string[]): string => onset.filter((p) => p !== 'Q' && p !== 'N').join('');

export const romajiOf = (kana: string): string => kana
  .split(/([\s、。！？!?,.・]+)/u)
  .map((part) => (/^[\s、。！？!?,.・]+$/u.test(part) ? part.replace(/、/g, ', ').replace(/。/g, '. ').replace(/[！!]/g, '! ').replace(/[？?]/g, '? ').replace(/・/g, ' ') : morae(part).map((m) => m.romaji).join('')))
  .join('')
  .replace(/\s+/g, ' ')
  .trim();

const hasKanji = (s: string): boolean => /\p{Script=Han}/u.test(s);

/**
 * A Japanese line written with its readings: {水|みず} を ください. Braces hold a kanji word and its kana reading. The
 * same braces mark a kana word that is not said as written — the particle は, said わ: こんにち{は|わ} — whose reading
 * is used for the sound and the romaji but is not printed over it (furigana go over kanji only). Spaces mark words
 * for the romaji ("mizu o kudasai"); Japanese itself is written without them, so they are dropped from the text.
 */
export const parseJa = (marked: string): { text: string; ja: JaText } => {
  const pieces: JaText['ruby'] = [];
  const re = /\{([^|{}]+)\|([^{}]+)\}/g;
  let last = 0;
  for (let m = re.exec(marked); m; m = re.exec(marked)) {
    if (m.index > last) pieces.push({ text: marked.slice(last, m.index) });
    pieces.push({ text: m[1], reading: m[2] });
    last = m.index + m[0].length;
  }
  if (last < marked.length) pieces.push({ text: marked.slice(last) });
  const spoken = pieces.map((r) => r.reading ?? r.text).join('');
  const ruby = pieces.map((r) => ({ ...r, text: r.text.replace(/\s+/g, '') })).filter((r) => r.text);
  const kana = spoken.replace(/\s+/g, '');
  if (hasKanji(kana)) throw new Error(`kanji without a reading in ${marked}`);
  return { text: ruby.map((r) => r.text).join(''), ja: { kana, romaji: romajiOf(spoken), ruby } };
};

/** Whether a piece of a line gets furigana printed over it: kanji only. */
export const needsReading = (piece: JaText['ruby'][number]): boolean => !!piece.reading && hasKanji(piece.text);

/**
 * The line in kana AS WRITTEN — kanji replaced by their readings, but a particle kept as the letter it is written
 * with (こんにちは, not the こんにちわ it is said as, which would be a spelling mistake on a child's screen). It has the
 * same beats as the spoken kana: は and わ are one beat each.
 */
export const writtenKana = (ja: JaText): string => ja.ruby.map((p) => (needsReading(p) ? p.reading! : p.text)).join('');

/** Beats in a line (punctuation dropped) — the recording time limit and the tests count them. */
export const moraCount = (kana: string): number => morae(kana).length;

/**
 * The sound sequences a scorer may have used for a line, each with the beat every sound belongs to. Azure scores
 * Japanese sound by sound but names none of them, and how it writes a long vowel differs between words (ラーメン came
 * back as five sounds, おばあさん as seven), so there are variants: a long vowel as one sound or two, and を as o or
 * wo. The alignment takes the variant whose length matches, and only if exactly one does — the same "no fit, no
 * name" rule as French.
 */
export const phoneCandidates = (kana: string): { phones: string[]; mora: number[] }[] => {
  const ms = morae(kana);
  const out: { phones: string[]; mora: number[] }[] = [];
  for (const longAsTwo of [false, true]) {
    for (const woAsTwo of [false, true]) {
      const phones: string[] = [];
      const mora: number[] = [];
      ms.forEach((m, i) => {
        const push = (p: string) => { phones.push(p); mora.push(i); };
        if (m.long) { if (longAsTwo) push(m.vowel); return; }
        const wo = m.kana === 'を' || m.kana === 'ヲ';
        if (wo && woAsTwo) push('w');
        m.onset.forEach(push);
        if (m.vowel) push(m.vowel);
      });
      if (!out.some((c) => c.mora.join() === mora.join())) out.push({ phones, mora });
    }
  }
  return out;
};
