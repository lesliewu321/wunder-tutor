import type { PhonemeId } from '../../domain/types';
import type { AlignmentCandidate, WordPhones } from '../lexicon';

// Pronunciation lexicon for French, in the same shape as the English one: "syl.la.bles|ph ph . ph ph".
//
// This file is what makes French feedback worth having. Azure scores French per phoneme but does NOT name the
// phonemes (the same gap as British English), so a score on its own can only say "something in this word was wrong".
// Lining those unnamed scores up against the sequence written here is what turns them into "your rue came out as
// roo" — see `frAlignmentCandidates`, and `namePhonemes` in src/speech/azureProvider.ts for the English precedent.
//
// Conventions, all of which matter for the alignment to hold:
//   * Silent final consonants are NOT written: petit is "p ə . t i", not "…t i t". French spelling has many of them.
//   * Liaison is not written either. These are citation forms, one word at a time; a phrase that links (les amis)
//     is a separate problem and is deliberately not solved here.
//   * r is always /ʁ/, the uvular one. There is no /r/ in French.
//   * "un" is written /ɛ̃/, not /œ̃/: the two merged for most speakers, and the teaching catalogue has no œ̃.
//   * /ɥ/ (huit, nuit) and /j/ (bien) are glides we do not teach; they appear here because the words need them, and
//     an untaught sound simply gets the generic guide rather than a wrong one.
const RAW: Record<string, string> = {
  // Greetings and politeness
  bonjour: 'bon.jour|b ɔ̃ . ʒ u ʁ', salut: 'sa.lut|s a . l y', bonsoir: 'bon.soir|b ɔ̃ . s w a ʁ',
  merci: 'mer.ci|m ɛ ʁ . s i', pardon: 'par.don|p a ʁ . d ɔ̃', excusez: 'ex.cu.sez|ɛ k s . k y . z e',
  oui: 'oui|w i', non: 'non|n ɔ̃', "s'il": "s'il|s i l", vous: 'vous|v u', plaît: 'plaît|p l ɛ',
  au: 'au|o', revoir: 're.voir|ʁ ə . v w a ʁ', madame: 'ma.da.me|m a . d a m', monsieur: 'mon.sieur|m ə . s j ø',

  // People
  je: 'je|ʒ ə', tu: 'tu|t y', il: 'il|i l', elle: 'elle|ɛ l', nous: 'nous|n u', moi: 'moi|m w a', toi: 'toi|t w a',
  ami: 'a.mi|a . m i', amie: 'a.mie|a . m i', mère: 'mè.re|m ɛ ʁ', père: 'pè.re|p ɛ ʁ',
  sœur: 'sœur|s œ ʁ', frère: 'frè.re|f ʁ ɛ ʁ', jeune: 'jeu.ne|ʒ œ n',

  // Numbers
  un: 'un|ɛ̃', une: 'u.ne|y n', deux: 'deux|d ø', trois: 'trois|t ʁ w a', quatre: 'qua.tre|k a . t ʁ ə',
  cinq: 'cinq|s ɛ̃ k', six: 'six|s i s', sept: 'sept|s ɛ t', huit: 'huit|ɥ i t', neuf: 'neuf|n œ f', dix: 'dix|d i s',

  // Food and drink
  pain: 'pain|p ɛ̃', eau: 'eau|o', café: 'ca.fé|k a . f e', thé: 'thé|t e', lait: 'lait|l ɛ', jus: 'jus|ʒ y',
  pomme: 'pom.me|p ɔ m', fromage: 'fro.ma.ge|f ʁ ɔ . m a ʒ', gâteau: 'gâ.teau|g ɑ . t o',
  croissant: 'crois.sant|k ʁ w a . s ɑ̃', chocolat: 'cho.co.lat|ʃ ɔ . k ɔ . l a', poisson: 'pois.son|p w a . s ɔ̃',
  poulet: 'pou.let|p u . l ɛ', riz: 'riz|ʁ i', salade: 'sa.la.de|s a . l a d', soupe: 'sou.pe|s u p',
  sucre: 'su.cre|s y . k ʁ ə', menu: 'me.nu|m ə . n y', addition: 'ad.di.tion|a . d i . s j ɔ̃',
  table: 'ta.ble|t a . b l ə', verre: 'ver.re|v ɛ ʁ', assiette: 'as.siet.te|a . s j ɛ t',
  restaurant: 'res.tau.rant|ʁ ɛ s . t o . ʁ ɑ̃',

  // Describing things
  bon: 'bon|b ɔ̃', bonne: 'bon.ne|b ɔ n', grand: 'grand|g ʁ ɑ̃', petit: 'pe.tit|p ə . t i',
  rouge: 'rou.ge|ʁ u ʒ', bleu: 'bleu|b l ø', vert: 'vert|v ɛ ʁ', jaune: 'jau.ne|ʒ o n',
  noir: 'noir|n w a ʁ', blanc: 'blanc|b l ɑ̃', très: 'très|t ʁ ɛ', beaucoup: 'beau.coup|b o . k u',
  heureux: 'heu.reux|œ . ʁ ø', peu: 'peu|p ø',

  // Places and things
  maison: 'mai.son|m ɛ . z ɔ̃', école: 'é.co.le|e . k ɔ l', livre: 'li.vre|l i . v ʁ ə',
  chat: 'chat|ʃ a', chien: 'chien|ʃ j ɛ̃', fleur: 'fleur|f l œ ʁ', montagne: 'mon.ta.gne|m ɔ̃ . t a ɲ',
  espagne: 'es.pa.gne|ɛ s . p a ɲ', rue: 'rue|ʁ y', paris: 'pa.ris|p a . ʁ i', france: 'fran.ce|f ʁ ɑ̃ s',
  français: 'fran.çais|f ʁ ɑ̃ . s ɛ', anglais: 'an.glais|ɑ̃ . g l ɛ',

  // Time
  jour: 'jour|ʒ u ʁ', nuit: 'nuit|n ɥ i', matin: 'ma.tin|m a . t ɛ̃', temps: 'temps|t ɑ̃',

  // Doing things
  voudrais: 'vou.drais|v u . d ʁ ɛ', veux: 'veux|v ø', peux: 'peux|p ø', aime: 'ai.me|ɛ m',
  manger: 'man.ger|m ɑ̃ . ʒ e', boire: 'boi.re|b w a ʁ', parler: 'par.ler|p a ʁ . l e',
  écouter: 'é.cou.ter|e . k u . t e', répéter: 'ré.pé.ter|ʁ e . p e . t e',

  // Small words that hold a sentence together
  le: 'le|l ə', la: 'la|l a', les: 'les|l e', de: 'de|d ə', du: 'du|d y', et: 'et|e', est: 'est|ɛ',
  que: 'que|k ə', qui: 'qui|k i', où: 'où|u', dans: 'dans|d ɑ̃', sur: 'sur|s y ʁ', avec: 'a.vec|a . v ɛ k',
  pour: 'pour|p u ʁ', comment: 'com.ment|k ɔ . m ɑ̃', ça: 'ça|s a', va: 'va|v a', bien: 'bien|b j ɛ̃',
};

/** é and è are different words from e; the key keeps them, and only punctuation is thrown away. */
export const frWordKey = (word: string): string =>
  word.toLowerCase().normalize('NFC').replace(/[’]/g, "'").replace(/[^a-zà-ÿœæ'-]/gu, '');

/** Accents are easy to leave off a keyboard, so a word typed bare still finds its entry. */
const bare = (key: string): string => key.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
const BARE: Record<string, string> = Object.fromEntries(Object.keys(RAW).map((k) => [bare(k), k]));

const entry = (key: string): string | undefined => RAW[key] ?? RAW[BARE[bare(key)] ?? ''];

export const frWordPhones = (word: string): WordPhones => {
  const key = frWordKey(word);
  const raw = entry(key);
  // No guessing from spelling: French spelling to sound is exactly the thing a learner cannot do, and a guess here
  // would put a confident wrong name on a sound. An unknown word is practised, just never coached per phoneme.
  if (!raw) return { word, key, syllables: [{ text: word, phonemes: [] }] };
  const [sylText, phones] = raw.split('|');
  const texts = sylText.split('.');
  return {
    word,
    key,
    syllables: phones.split(' . ').map((group, i) => ({ text: texts[i] ?? '', phonemes: group.trim().split(/\s+/) })),
  };
};

/**
 * The phoneme sequence a scorer may have used for this word, for putting names on unnamed per-phoneme scores.
 * French has no accent split to allow for (the British silent R is what makes the English version return two), so
 * there is either one candidate or, for a word the lexicon does not know, none at all.
 */
export const frAlignmentCandidates = (word: string): AlignmentCandidate[] => {
  const raw = entry(frWordKey(word));
  if (!raw) return [];
  const phonemes = raw.split('|')[1].split(/\s+/).filter((t) => t && t !== '.');
  return [{ phonemes, silent: phonemes.map(() => false) }];
};

export const frTokenize = (text: string): string[] =>
  text.split(/\s+/).map((t) => t.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '')).filter(Boolean);

export const frPhonemesIn = (text: string): PhonemeId[] =>
  frTokenize(text).flatMap((w) => frWordPhones(w).syllables.flatMap((s) => s.phonemes));

/** How many syllables the lexicon knows this text to have — the recording time limit needs it. */
export const frSyllableCount = (text: string): number =>
  frTokenize(text).reduce((n, w) => n + Math.max(1, frWordPhones(w).syllables.filter((s) => s.phonemes.length).length), 0);

/** Every sound the French catalogue could be asked about, for tests and for the Lab's ordering. */
export const FR_LEXICON_WORDS = Object.keys(RAW);
