import { describe, expect, it } from 'vitest';
import { esAlignmentCandidates, esPhones, esSyllableCount, esSyllables, esTokenize } from '../content/es/lexicon';
import { blockCount, blocks, decompose, phoneCandidates, romanize } from '../content/ko/hangul';

// The two language models under the Korean and Spanish courses: hangul blocks of the PRONOUNCED form, and Spanish
// sounds from spelling. Both feed the display, the recording time limit, the mock scorer and the alignment of the
// real scorer's unnamed per-sound scores.

describe('Korean: blocks of the pronounced form', () => {
  it('takes a block apart and romanises from the sound (Revised Romanization)', () => {
    expect(decompose('한')).toEqual({ initial: 'ㅎ', medial: 'ㅏ', final: 'ㄴ' });
    expect(romanize('안녕하세요')).toBe('annyeonghaseyo');
    expect(romanize('궁물')).toBe('gungmul'); // 국물 as it is said
    expect(romanize('가치')).toBe('gachi'); // 같이 as it is said
    // Romanised from the PRONOUNCED form: the data writes each item's romaja by hand where the standard differs
    // (Revised Romanization does not show tensification: 떡볶이 is tteokbokki, although it is said 떡뽀끼).
    expect(romanize('떡')).toBe('tteok');
    expect(romanize('물 주세요')).toBe('mul juseyo');
  });

  it('names the sound each block is taught as, tense before aspirated before ㄹ before the vowels before 받침', () => {
    expect(blocks('떡').map((b) => b.unit)).toEqual(['ko:tense']);
    expect(blocks('커피').map((b) => b.unit)).toEqual(['ko:aspirated', 'ko:aspirated']);
    expect(blocks('물').map((b) => b.unit)).toEqual(['ko:r']);
    expect(blocks('서').map((b) => b.unit)).toEqual(['ko:eo']);
    expect(blocks('그').map((b) => b.unit)).toEqual(['ko:eu']);
    expect(blocks('밥').map((b) => b.unit)).toEqual(['ko:batchim']);
    expect(blocks('아').map((b) => b.unit)).toEqual([undefined]);
  });

  it('counts one beat per block, ignoring spaces and punctuation', () => {
    expect(blockCount('물 주세요!')).toBe(4);
  });

  it('offers a glide vowel as one sound or two, so the scorer\'s count can be matched', () => {
    const ways = phoneCandidates('야');
    expect(ways.map((w) => w.phones.length).sort()).toEqual([1, 2]);
    expect(phoneCandidates('밥')[0]).toEqual({ phones: ['p', 'a', 'p̚'], block: [0, 0, 0] });
    expect(phoneCandidates('안녕')[0]).toEqual({ phones: ['a', 'n', 'n', 'j', 'ʌ', 'ŋ'], block: [0, 0, 1, 1, 1, 1] }); // ㅇ at the start is silence; ㅕ as j + ʌ first
  });
});

describe('Spanish: sounds from spelling (Spain)', () => {
  it('reads the rules: c/z before e i, silent h and u, ll, ñ, j, rr, ch', () => {
    const s = (w: string) => esPhones(w).map((p) => p.sound).join(' ');
    expect(s('cerveza')).toBe('θ e ɾ b e θ a');
    expect(s('queso')).toBe('k e s o');
    expect(s('guitarra')).toBe('g i t a r a');
    expect(s('hola')).toBe('o l a');
    expect(s('llave')).toBe('ʝ a b e');
    expect(s('niño')).toBe('n i ɲ o');
    expect(s('jamón')).toBe('x a m o n');
    expect(s('perro')).toBe('p e r o');
    expect(s('pero')).toBe('p e ɾ o');
    expect(s('rojo')).toBe('r o x o');
    expect(s('chocolate')).toBe('tʃ o k o l a t e');
    expect(s('agua')).toBe('a g w a');
    expect(s('bien')).toBe('b j e n');
    expect(s('hoy')).toBe('o i');
    expect(s('yo')).toBe('ʝ o');
  });

  it('splits syllables one per vowel, consonants before their vowel', () => {
    expect(esSyllables('chocolate').map((x) => x.text)).toEqual(['cho', 'co', 'la', 'te']);
    expect(esSyllables('perro').map((x) => x.text)).toEqual(['pe', 'rro']);
    expect(esSyllables('sol').map((x) => x.text)).toEqual(['sol']);
    expect(esSyllableCount('Quiero un zumo de naranja.')).toBe(9);
    expect(esTokenize('¿Qué tal? ¡Hola!')).toEqual(['Qué', 'tal', 'Hola']);
  });

  it('names taught sounds and leaves the rest unnamed, with variants for a glide and its vowel', () => {
    const [one] = esAlignmentCandidates('perro');
    expect(one.phonemes).toEqual(['', '', 'es:rr', '']);
    const ways = esAlignmentCandidates('bien').map((c) => c.phonemes.length).sort();
    expect(ways).toEqual([3, 4]);
  });
});
