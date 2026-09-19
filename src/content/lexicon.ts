import type { Accent, PhonemeId } from '../domain/types';

// Pronunciation lexicon for curriculum words: "syl.la.bles|ph ph . ph ph".
// General American is the base; `r~` marks a post-vocalic R and ɚ/ɝ are R-coloured vowels,
// all of which are legitimately R-less in British English (see forAccent).
const RAW: Record<string, string> = {
  a: 'a|ə', an: 'an|ə n', and: 'and|æ n d', am: 'am|æ m', at: 'at|æ t', add: 'add|æ d',
  apple: 'ap.ple|æ . p ə l', apples: 'ap.ples|æ . p ə l z', around: 'a.round|ə . r aʊ n d',
  banana: 'ba.na.na|b ə . n æ . n ə', berry: 'ber.ry|b ɛ . r i', big: 'big|b ɪ g', bit: 'bit|b ɪ t',
  bread: 'bread|b r ɛ d', breakfast: 'break.fast|b r ɛ k . f ə s t', brother: 'bro.ther|b r ʌ . ð ɚ',
  can: 'can|k æ n', cat: 'cat|k æ t', cheese: 'cheese|tʃ i z', chicken: 'chi.cken|tʃ ɪ . k ə n',
  chocolate: 'choc.late|tʃ ɔ k . l ə t', corner: 'cor.ner|k ɔ r~ . n ɚ', could: 'could|k ʊ d', cup: 'cup|k ʌ p',
  dish: 'dish|d ɪ ʃ', do: 'do|d u', drink: 'drink|d r ɪ ŋ k', eat: 'eat|i t',
  favourite: 'fa.vou.rite|f eɪ . v ə . r ɪ t', favorite: 'fa.vo.rite|f eɪ . v ə . r ɪ t',
  fish: 'fish|f ɪ ʃ', five: 'five|f aɪ v', flies: 'flies|f l aɪ z', food: 'food|f u d', for: 'for|f ɔ r~',
  fresh: 'fresh|f r ɛ ʃ', fries: 'fries|f r aɪ z', friend: 'friend|f r ɛ n d',
  glass: 'glass|g l æ s', good: 'good|g ʊ d', great: 'great|g r eɪ t', goodbye: 'good.bye|g ʊ d . b aɪ',
  happy: 'hap.py|h æ . p i', hat: 'hat|h æ t', have: 'have|h æ v', hello: 'hel.lo|h ə . l oʊ', hi: 'hi|h aɪ',
  hot: 'hot|h ɑ t', hungry: 'hun.gry|h ʌ ŋ . g r i', i: 'I|aɪ', "i'll": "I'll|aɪ l", "i'm": "I'm|aɪ m",
  in: 'in|ɪ n', is: 'is|ɪ z', it: 'it|ɪ t', juice: 'juice|dʒ u s',
  lemon: 'le.mon|l ɛ . m ə n', lemonade: 'le.mo.nade|l ɛ . m ə . n eɪ d', like: 'like|l aɪ k',
  lion: 'li.on|l aɪ . ə n', lions: 'li.ons|l aɪ . ə n z', little: 'lit.tle|l ɪ . t ə l', look: 'look|l ʊ k', love: 'love|l ʌ v',
  me: 'me|m i', menu: 'men.u|m ɛ n . j u', milk: 'milk|m ɪ l k', monkey: 'mon.key|m ʌ ŋ . k i', monkeys: 'mon.keys|m ʌ ŋ . k i z',
  mother: 'mo.ther|m ʌ . ð ɚ', mouth: 'mouth|m aʊ θ', much: 'much|m ʌ tʃ', my: 'my|m aɪ',
  next: 'next|n ɛ k s t', nice: 'nice|n aɪ s', no: 'no|n oʊ', now: 'now|n aʊ', of: 'of|ə v', on: 'on|ɑ n', one: 'one|w ʌ n',
  orange: 'or.ange|ɔ . r ɪ n dʒ', play: 'play|p l eɪ', please: 'please|p l i z',
  recommend: 're.com.mend|r ɛ . k ə . m ɛ n d', red: 'red|r ɛ d', restaurant: 'res.tau.rant|r ɛ s . t ə . r ɑ n t',
  right: 'right|r aɪ t', sandwich: 'sand.wich|s æ n d . w ɪ tʃ', sat: 'sat|s æ t', see: 'see|s i', seven: 'se.ven|s ɛ . v ə n',
  sheep: 'sheep|ʃ i p', ship: 'ship|ʃ ɪ p', sink: 'sink|s ɪ ŋ k', some: 'some|s ʌ m', sounds: 'sounds|s aʊ n d z', street: 'street|s t r i t',
  thank: 'thank|θ æ ŋ k', thanks: 'thanks|θ æ ŋ k s', that: 'that|ð æ t', the: 'the|ð ə', they: 'they|ð eɪ', though: 'though|ð oʊ',
  thing: 'thing|θ ɪ ŋ', things: 'things|θ ɪ ŋ z', think: 'think|θ ɪ ŋ k', thirsty: 'thir.sty|θ ɝ . s t i', this: 'this|ð ɪ s',
  three: 'three|θ r i', to: 'to|t ə', too: 'too|t u', tree: 'tree|t r i', turn: 'turn|t ɝ n',
  vegetables: 'vege.ta.bles|v ɛ dʒ . t ə . b ə l z', very: 've.ry|v ɛ . r i', village: 'vil.lage|v ɪ . l ɪ dʒ', visit: 'vi.sit|v ɪ . z ɪ t',
  want: 'want|w ɑ n t', warm: 'warm|w ɔ r~ m', water: 'wa.ter|w ɔ . t ɚ', we: 'we|w i', what: 'what|w ʌ t', would: 'would|w ʊ d',
  yellow: 'yel.low|j ɛ . l oʊ', yes: 'yes|j ɛ s', you: 'you|j u', your: 'your|j ɔ r~', zoo: 'zoo|z u',
  // Pronunciation Lab syllables
  tha: 'tha|θ ɑ', thee: 'thee|θ i', thoo: 'thoo|θ u', ra: 'ra|r ɑ', ree: 'ree|r i', roo: 'roo|r u',
  va: 'va|v ɑ', vee: 'vee|v i', voo: 'voo|v u', wa: 'wa|w ɑ', wee: 'wee|w i', woo: 'woo|w u',
  la: 'la|l ɑ', lee: 'lee|l i', loo: 'loo|l u',
  // Minimal-pair words (listening drills, the accuracy test set, future content)
  free: 'free|f r i', thin: 'thin|θ ɪ n', fin: 'fin|f ɪ n', thirst: 'thirst|θ ɝ s t', first: 'first|f ɝ s t', sank: 'sank|s æ ŋ k',
  mouse: 'mouse|m aʊ s', tin: 'tin|t ɪ n', day: 'day|d eɪ', then: 'then|ð ɛ n', den: 'den|d ɛ n', those: 'those|ð oʊ z', doze: 'doze|d oʊ z',
  vest: 'vest|v ɛ s t', west: 'west|w ɛ s t', vine: 'vine|v aɪ n', wine: 'wine|w aɪ n', vet: 'vet|v ɛ t', wet: 'wet|w ɛ t',
  rice: 'rice|r aɪ s', lice: 'lice|l aɪ s', light: 'light|l aɪ t', grass: 'grass|g r æ s', wed: 'wed|w ɛ d', ring: 'ring|r ɪ ŋ', wing: 'wing|w ɪ ŋ',
  night: 'night|n aɪ t', low: 'low|l oʊ', snow: 'snow|s n oʊ', slow: 'slow|s l oʊ', sit: 'sit|s ɪ t', seat: 'seat|s i t', live: 'live|l ɪ v', leave: 'leave|l i v',
  bad: 'bad|b æ d', bed: 'bed|b ɛ d', man: 'man|m æ n', men: 'men|m ɛ n', set: 'set|s ɛ t', she: 'she|ʃ i', sheet: 'sheet|ʃ i t',
  peas: 'peas|p i z', peace: 'peace|p i s', eyes: 'eyes|aɪ z', ice: 'ice|aɪ s', prize: 'prize|p r aɪ z', price: 'price|p r aɪ s',
  late: 'late|l eɪ t', lay: 'lay|l eɪ', made: 'made|m eɪ d', may: 'may|m eɪ', bike: 'bike|b aɪ k', buy: 'buy|b aɪ',
  full: 'full|f ʊ l', fool: 'fool|f u l', pull: 'pull|p ʊ l', pool: 'pool|p u l', sing: 'sing|s ɪ ŋ', sin: 'sin|s ɪ n', jeep: 'jeep|dʒ i p', cheap: 'cheap|tʃ i p',
  boat: 'boat|b oʊ t', are: 'are|ɑ r~', go: 'go|g oʊ',
};

/**
 * Standard Southern British forms where the vowel itself differs, not just the R:
 * BATH words take the long "ah" (glass, banana), LOT words the short rounded ɒ (hot, what, orange).
 * GOAT (oʊ → əʊ) is handled for every word in forAccent.
 */
const RAW_GB: Record<string, string> = {
  restaurant: 'res.taurant|r ɛ s . t r ɒ n t',
  glass: 'glass|g l ɑ s', grass: 'grass|g r ɑ s', banana: 'ba.na.na|b ə . n ɑ . n ə',
  hot: 'hot|h ɒ t', on: 'on|ɒ n', want: 'want|w ɒ n t', what: 'what|w ɒ t', chocolate: 'choc.late|tʃ ɒ k . l ə t', orange: 'or.ange|ɒ . r ɪ n dʒ',
};

export interface SyllablePhones { text: string; phonemes: PhonemeId[] }
export interface WordPhones { word: string; key: string; syllables: SyllablePhones[] }

const forAccent = (ph: string, accent: Accent): string | null => {
  if (accent === 'en-GB') {
    if (ph === 'r~') return null;
    if (ph === 'ɚ') return 'ə';
    if (ph === 'ɝ') return 'ɜ';
    if (ph === 'oʊ') return 'əʊ';
  }
  return ph === 'r~' ? 'r' : ph;
};

// Rough letter-to-sound fallback so unscripted text (AI practice, future content) still gets
// plausible phonemes from the mock provider. A real provider returns its own phonemes.
const DIGRAPHS: [string, string[]][] = [
  ['tch', ['tʃ']], ['igh', ['aɪ']], ['th', ['θ']], ['sh', ['ʃ']], ['ch', ['tʃ']], ['ph', ['f']], ['ng', ['ŋ']], ['ck', ['k']],
  ['wh', ['w']], ['qu', ['k', 'w']], ['ee', ['i']], ['ea', ['i']], ['oo', ['u']], ['ou', ['aʊ']], ['ow', ['oʊ']], ['ai', ['eɪ']],
  ['ay', ['eɪ']], ['oy', ['ɔɪ']], ['oi', ['ɔɪ']], ['er', ['ɚ']], ['ir', ['ɝ']], ['ur', ['ɝ']], ['ar', ['ɑ', 'r~']], ['or', ['ɔ', 'r~']],
];
const LETTERS: Record<string, string[]> = {
  a: ['æ'], b: ['b'], c: ['k'], d: ['d'], e: ['ɛ'], f: ['f'], g: ['g'], h: ['h'], i: ['ɪ'], j: ['dʒ'], k: ['k'], l: ['l'], m: ['m'],
  n: ['n'], o: ['ɑ'], p: ['p'], q: ['k'], r: ['r'], s: ['s'], t: ['t'], u: ['ʌ'], v: ['v'], w: ['w'], x: ['k', 's'], y: ['i'], z: ['z'],
};

const guess = (word: string): string[] => {
  let w = word.replace(/[^a-z]/g, '');
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  const out: string[] = [];
  for (let i = 0; i < w.length; ) {
    const d = DIGRAPHS.find(([g]) => w.startsWith(g, i));
    if (d) { out.push(...d[1]); i += d[0].length; continue; }
    if (w[i] === 'y' && i === 0) out.push('j');
    else if (w[i] !== w[i - 1]) out.push(...(LETTERS[w[i]] ?? []));
    i += 1;
  }
  return out.length ? out : ['ə'];
};

/** A word's key for the memory of personal bests: letters for English, characters for Chinese. */
export const wordKey = (word: string): string => word.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z'\p{Script=Han}]/gu, '');

export const tokenize = (text: string): string[] =>
  text.split(/\s+/).map((t) => t.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '')).filter(Boolean);

export const wordPhones = (word: string, accent: Accent): WordPhones => {
  const key = wordKey(word);
  const raw = (accent === 'en-GB' && RAW_GB[key]) || RAW[key];
  const map = (phs: string[]) => phs.map((p) => forAccent(p, accent)).filter((p): p is string => !!p);
  if (!raw) return { word, key, syllables: [{ text: word, phonemes: map(guess(key)) }] };
  const [sylText, phones] = raw.split('|');
  const texts = sylText.split('.');
  const groups = phones.split(' . ').map((g) => map(g.trim().split(/\s+/)));
  return { word, key, syllables: groups.map((phonemes, i) => ({ text: texts[i] ?? '', phonemes })) };
};

export interface AlignmentCandidate { phonemes: PhonemeId[]; /** Slots a scorer may report but that must never be coached (a British silent R). */ silent: boolean[] }

/**
 * Phoneme sequences a scorer might have used for a word, for putting names on unnamed per-phoneme scores
 * (Azure names phonemes only for en-US). Measured against Azure en-GB on the lesson vocabulary: 93% of words
 * match the British sequence outright; the rest keep a slot for post-vocalic R ("turn" = t ɜ r n), which is the
 * second candidate here. Unknown words return nothing — a guessed spelling-to-sound mapping must not name sounds.
 */
export const alignmentCandidates = (word: string, accent: Accent): AlignmentCandidate[] => {
  const key = wordKey(word);
  const raw = (accent === 'en-GB' && RAW_GB[key]) || RAW[key];
  if (!raw) return [];
  const tokens = raw.split('|')[1].split(/\s+/).filter((t) => t && t !== '.');
  const plain = tokens.map((t) => forAccent(t, accent)).filter((t): t is string => !!t);
  const out: AlignmentCandidate[] = [{ phonemes: plain, silent: plain.map(() => false) }];
  if (accent === 'en-GB') {
    const phonemes: string[] = [];
    const silent: boolean[] = [];
    for (const t of tokens) {
      if (t === 'r~') { phonemes.push('r'); silent.push(true); }
      else if (t === 'ɚ') { phonemes.push('ə', 'r'); silent.push(false, true); }
      else if (t === 'ɝ') { phonemes.push('ɜ', 'r'); silent.push(false, true); }
      else { phonemes.push(t); silent.push(false); }
    }
    if (phonemes.length !== plain.length) out.push({ phonemes, silent });
  }
  return out;
};

export const textPhones = (text: string, accent: Accent): WordPhones[] => tokenize(text).map((w) => wordPhones(w, accent));

export const phonemesIn = (text: string, accent: Accent): PhonemeId[] =>
  textPhones(text, accent).flatMap((w) => w.syllables.flatMap((s) => s.phonemes));

/** Syllables in a text: English words by the lexicon, Chinese one per character. */
export const syllableCount = (text: string): number =>
  [...text].filter((c) => /\p{Script=Han}/u.test(c)).length + textPhones(text, 'en-US').reduce((n, w) => n + w.syllables.length, 0);
