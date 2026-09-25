import type { PhonemeId } from '../../domain/types';

// Spanish as it is spoken, from how it is written. Unlike French, Spanish spelling says how a word sounds nearly
// every time, so no hand-written lexicon is needed: a few rules turn a word into its sounds (Spain Spanish, the
// scorer's es-ES — c/z before e, i are the "th" of distinción, ll is said like y). What comes out is used three
// ways: the mock scorer's syllables, the sound sequence the real scorer's unnamed per-sound scores are lined up
// with (src/speech/azureProvider.ts, as for French), and the taught sound each sound belongs to (es/sounds.ts).
//
// The sounds are written in plain IPA here; the TAUGHT ids are namespaced ("es:rr", "es:j"…) so that a Spanish r
// and an English r never share a slot in a learner's profile.

const STRONG = 'aeoáéó';

/** Which taught sound an IPA sound belongs to; sounds not taught are left unnamed (''), as the Japanese course does. */
export const ES_UNIT: Record<string, PhonemeId> = { ɾ: 'es:r', r: 'es:rr', x: 'es:j', ɲ: 'es:ñ', θ: 'es:z', b: 'es:b', ʝ: 'es:ll' };

export const esTokenize = (text: string): string[] =>
  text.split(/\s+/).map((t) => t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')).filter(Boolean);

/** A word's key for the memory of personal bests: lower case, accents kept (café and cafe are different words). */
export const esWordKey = (word: string): string => word.toLowerCase().replace(/[^\p{L}]/gu, '');

/** The sounds of a word, in order, with the letters each came from. */
export function esPhones(word: string): { sound: string; letters: string }[] {
  const w = word.toLowerCase().replace(/[^\p{L}]/gu, '');
  const out: { sound: string; letters: string }[] = [];
  const push = (sound: string, letters: string) => out.push({ sound, letters });
  for (let i = 0; i < w.length; i++) {
    const c = w[i], next = w[i + 1] ?? '', prev = w[i - 1] ?? '';
    switch (c) {
      case 'a': case 'á': push('a', c); break;
      case 'e': case 'é': push('e', c); break;
      case 'o': case 'ó': push('o', c); break;
      case 'i': case 'í': case 'y': {
        // y as a vowel at the end of a word or alone (hoy, y); a glide before a vowel (yo, ya); i before a strong vowel is a glide.
        if (c === 'y' && (i === w.length - 1 || w.length === 1)) push('i', c);
        else if (c === 'y') push('ʝ', c);
        else push(c === 'i' && STRONG.includes(next) ? 'j' : 'i', c);
        break;
      }
      case 'u': case 'ú': case 'ü': {
        if (c === 'u' && (prev === 'q' || (prev === 'g' && 'eiéí'.includes(next)))) break; // silent: que, qui, gue, gui
        push(c !== 'ú' && (STRONG.includes(next) || next === 'i') ? 'w' : 'u', c);
        break;
      }
      case 'b': case 'v': push('b', c); break;
      case 'c':
        if (next === 'h') { push('tʃ', 'ch'); i++; }
        else push('eiéí'.includes(next) ? 'θ' : 'k', c);
        break;
      case 'd': push('d', c); break;
      case 'f': push('f', c); break;
      case 'g':
        if ('eiéí'.includes(next)) push('x', c);
        else push('g', c);
        break;
      case 'h': break; // silent
      case 'j': push('x', c); break;
      case 'k': push('k', c); break;
      case 'l':
        if (next === 'l') { push('ʝ', 'll'); i++; } else push('l', c);
        break;
      case 'm': push('m', c); break;
      case 'n': push('n', c); break;
      case 'ñ': push('ɲ', c); break;
      case 'p': push('p', c); break;
      case 'q': push('k', c); break;
      case 'r':
        if (next === 'r') { push('r', 'rr'); i++; }
        else push(i === 0 || 'nls'.includes(prev) ? 'r' : 'ɾ', c);
        break;
      case 's': push('s', c); break;
      case 't': push('t', c); break;
      case 'w': push('w', c); break;
      case 'x': push('ks', c); break;
      case 'z': push('θ', c); break;
      default: break; // a letter Spanish does not use
    }
  }
  return out;
}

/** Syllables: one per vowel; the consonants (and glides) before a vowel go with it, the ones after the last vowel stay with it. */
export function esSyllables(word: string): { text: string; phonemes: PhonemeId[] }[] {
  const nucleus = new Set(['a', 'e', 'i', 'o', 'u']);
  const out: { text: string; phonemes: PhonemeId[] }[] = [];
  let pending: { text: string; phonemes: PhonemeId[] } = { text: '', phonemes: [] };
  const named = (sound: string): PhonemeId => ES_UNIT[sound] ?? (nucleus.has(sound) ? sound : '');
  for (const p of esPhones(word)) {
    pending.text += p.letters;
    pending.phonemes.push(named(p.sound));
    if (nucleus.has(p.sound)) { out.push(pending); pending = { text: '', phonemes: [] }; }
  }
  if (pending.text) {
    if (out.length) { const last = out[out.length - 1]; last.text += pending.text; last.phonemes.push(...pending.phonemes); }
    else out.push(pending);
  }
  return out.length ? out : [{ text: word, phonemes: [] }];
}

export interface EsWordPhones { word: string; key: string; syllables: { text: string; phonemes: PhonemeId[] }[] }
export const esWordPhones = (word: string): EsWordPhones => ({ word, key: esWordKey(word), syllables: esSyllables(word) });

export const esSyllableCount = (text: string): number => esTokenize(text).reduce((n, w) => n + esSyllables(w).length, 0);

/** The taught sounds a line practises, in order of appearance, once each. */
export const esPhonemesIn = (text: string): PhonemeId[] => [...new Set(esTokenize(text).flatMap((w) => esPhones(w).map((p) => ES_UNIT[p.sound]).filter(Boolean)))];

/**
 * The sound sequences a word may come back as from a scorer that counts sounds but names none: a glide and its
 * vowel as two sounds or one, ch and x as one or two. Each sequence carries the taught id per sound ('' when not
 * taught) and no silent slots. At most 8 variants.
 */
export function esAlignmentCandidates(word: string): { phonemes: PhonemeId[]; silent: boolean[] }[] {
  const phones = esPhones(word);
  let variants: PhonemeId[][] = [[]];
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i];
    const unit = ES_UNIT[p.sound] ?? '';
    const ways: PhonemeId[][] = [[unit]];
    if ((p.sound === 'j' || p.sound === 'w') && i + 1 < phones.length && 'aeiou'.includes(phones[i + 1].sound)) {
      // glide + vowel as one sound: skip the vowel next time round
      ways.push([]);
    }
    if (p.sound === 'tʃ' || p.sound === 'ks') ways.push([unit, '']);
    const merged = ways.length > 1 && variants.length < 8;
    variants = variants.flatMap((v) => (merged ? ways : [ways[0]]).map((way) => [...v, ...way]));
  }
  const seen = new Set<string>();
  return variants.filter((v) => { const k = v.join('|') + v.length; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((phonemes) => ({ phonemes, silent: phonemes.map(() => false) }));
}
