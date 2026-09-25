import { addCommunication } from '../../../astra-lessons/communication';
import type { Course, Exercise, Lesson, PhonemeId, SpeakItem, Unit } from '../../domain/types';
import type { LabStage } from '../lab';
import { frSyllableCount, frTokenize, frWordPhones } from './lexicon';

// French for everyone from five to grown-up, like the English and Mandarin courses — the bands are not the same
// lesson three times over. A six-year-old names colours and animals from pictures; an eleven-year-old asks for
// things; a teenager or an adult holds a short exchange in a café. The vocabulary overlaps on purpose, so a family
// learning together is learning the same words.
//
// Every word used here must be in the lexicon (fr/lexicon.ts) or its sounds cannot be named — there is a test for
// exactly that, because a word that slips through is not an error anyone would notice by reading.

/** A French speaking item. `focus` names the sounds the item is really here to practise. */
export const fr = (text: string, meaning: string, picture?: string, focus?: PhonemeId[]): SpeakItem => {
  const syllables = frSyllableCount(text);
  const words = frTokenize(text).length;
  return {
    id: `fr-${text.toLowerCase().replace(/[^a-zà-ÿœ']+/gu, '-').replace(/^-|-$/g, '')}`,
    text,
    lang: 'fr-FR',
    picture,
    meaning,
    focus,
    kind: words === 1 ? 'word' : /[?!.]$/.test(text) && syllables > 3 ? 'sentence' : words <= 3 ? 'phrase' : 'sentence',
  };
};

let n = 0;
const speak = (it: SpeakItem, prompt: 'text' | 'image' = 'text'): Exercise => ({ id: `fx-${++n}`, type: 'speak', item: it, prompt });
const heard = (answer: SpeakItem, ...others: SpeakItem[]): Exercise => ({ id: `fx-${++n}`, type: 'choose-heard', answer, options: [answer, ...others] });
const pair = (a: SpeakItem, b: SpeakItem, answerIndex: 0 | 1, focus: PhonemeId): Exercise => ({ id: `fx-${++n}`, type: 'minimal-pair', pair: [a, b], answerIndex, focus });
const dialogue = (tutor: SpeakItem, picture: string, ...replies: SpeakItem[]): Exercise => ({ id: `fx-${++n}`, type: 'dialogue', tutorLine: tutor.text, tutor, replies, picture });

// ---------- Words ----------
export const FW = {
  // Food and drink — the café unit's core, and picture-friendly for the little ones.
  pain: fr('pain', 'bread', '🥖', ['ɛ̃']),
  eau: fr('eau', 'water', '💧'),
  café: fr('café', 'coffee', '☕'),
  thé: fr('thé', 'tea', '🍵'),
  lait: fr('lait', 'milk', '🥛'),
  jus: fr('jus', 'juice', '🧃', ['ʒ', 'y']),
  pomme: fr('pomme', 'apple', '🍎'),
  fromage: fr('fromage', 'cheese', '🧀', ['ʁ', 'ʒ']),
  gâteau: fr('gâteau', 'cake', '🍰'),
  croissant: fr('croissant', 'croissant', '🥐', ['ʁ', 'ɑ̃']),
  chocolat: fr('chocolat', 'chocolate', '🍫'),
  poisson: fr('poisson', 'fish', '🐟', ['ɔ̃']),
  poulet: fr('poulet', 'chicken', '🍗'),
  riz: fr('riz', 'rice', '🍚', ['ʁ']),
  salade: fr('salade', 'salad', '🥗'),
  soupe: fr('soupe', 'soup', '🍲'),
  sucre: fr('sucre', 'sugar', '🍬', ['y', 'ʁ']),

  // Colours — single words with a picture, which is what a five-year-old can do on day one.
  rouge: fr('rouge', 'red', '🔴', ['ʁ', 'ʒ']),
  bleu: fr('bleu', 'blue', '🔵', ['ø']),
  vert: fr('vert', 'green', '🟢', ['ʁ']),
  jaune: fr('jaune', 'yellow', '🟡', ['ʒ']),
  noir: fr('noir', 'black', '⚫', ['ʁ']),
  blanc: fr('blanc', 'white', '⚪', ['ɑ̃']),

  // Numbers
  un: fr('un', 'one', '1️⃣', ['ɛ̃']),
  deux: fr('deux', 'two', '2️⃣', ['ø']),
  trois: fr('trois', 'three', '3️⃣', ['ʁ']),
  quatre: fr('quatre', 'four', '4️⃣', ['ʁ']),
  cinq: fr('cinq', 'five', '5️⃣', ['ɛ̃']),
  neuf: fr('neuf', 'nine', '9️⃣', ['œ']),

  // Around us
  chat: fr('chat', 'cat', '🐱'),
  chien: fr('chien', 'dog', '🐶', ['ɛ̃']),
  fleur: fr('fleur', 'flower', '🌸', ['œ', 'ʁ']),
  montagne: fr('montagne', 'mountain', '⛰️', ['ɲ', 'ɔ̃']),
  maison: fr('maison', 'house', '🏠', ['ɔ̃']),
  école: fr('école', 'school', '🏫'),
  livre: fr('livre', 'book', '📖', ['ʁ']),
  rue: fr('rue', 'street', '🛣️', ['ʁ', 'y']),
  jour: fr('jour', 'day', '☀️', ['ʒ', 'ʁ']),
  sœur: fr('sœur', 'sister', '👧', ['œ', 'ʁ']),
  frère: fr('frère', 'brother', '👦', ['ʁ']),

  // Minimal pairs: the sounds that decide which word you said.
  tu: fr('tu', 'you', '🫵', ['y']),
  vous: fr('vous', 'you (polite)', '🙋', ['u']),
  bon: fr('bon', 'good', '👍', ['ɔ̃']),
  blancPair: fr('blanc', 'white', '⚪', ['ɑ̃']),
  peu: fr('peu', 'a little', '🤏', ['ø']),
  pomme2: fr('pomme', 'apple', '🍎'),
} satisfies Record<string, SpeakItem>;

// ---------- Phrases and sentences ----------
export const FP = {
  bonjour: fr('bonjour', 'hello', '👋', ['ɔ̃', 'ʒ', 'ʁ']),
  salut: fr('salut', 'hi', '🙌', ['y']),
  merci: fr('merci', 'thank you', '🙏', ['ʁ']),
  oui: fr('oui', 'yes', '✅'),
  non: fr('non', 'no', '❌', ['ɔ̃']),
  auRevoir: fr('au revoir', 'goodbye', '👋', ['ʁ']),
  silVousPlaît: fr("s'il vous plaît", 'please', '🙏'),
  unCafé: fr('un café', 'a coffee', '☕', ['ɛ̃']),
  deuxCafés: fr('deux cafés', 'two coffees', '☕', ['ø']),
  unCroissant: fr('un croissant', 'a croissant', '🥐', ['ʁ', 'ɑ̃']),
  leChat: fr('le chat', 'the cat', '🐱'),
  unChienBlanc: fr('un chien blanc', 'a white dog', '🐶', ['ɛ̃', 'ɑ̃']),
  laFleurRouge: fr('la fleur rouge', 'the red flower', '🌸', ['œ', 'ʁ', 'ʒ']),
  jaimeLeChocolat: fr("j'aime le chocolat", 'I like chocolate', '🍫', ['ʒ']),
  unPeuDeSucre: fr('un peu de sucre', 'a little sugar', '🍬', ['ø', 'y']),
  jeVoudraisUnCafé: fr('je voudrais un café', "I'd like a coffee", '☕', ['ʒ', 'ʁ']),
  jeVoudraisUnCroissant: fr('je voudrais un croissant', "I'd like a croissant", '🥐', ['ʒ', 'ʁ', 'ɑ̃']),
  lAddition: fr("l'addition, s'il vous plaît", 'the bill, please', '🧾', ['ɔ̃']),
  commentÇaVa: fr('comment ça va', 'how are you', '🙂', ['ɑ̃']),
  trèsBien: fr('très bien, merci', 'very well, thank you', '😊', ['ʁ', 'ɛ̃']),
  cestTrèsBon: fr("c'est très bon", "it's very good", '😋', ['ʁ', 'ɔ̃']),
  jaiTrois: fr("j'ai trois pommes", 'I have three apples', '🍎', ['ʒ', 'ʁ']),
  deLEau: fr("de l'eau, s'il vous plaît", 'some water, please', '💧'),
} satisfies Record<string, SpeakItem>;

/** What the tutor says first in a dialogue. */
const T = {
  bonjour: fr('bonjour', 'hello', '👋', ['ɔ̃']),
  vousDésirez: fr('vous voudriez un café', 'would you like a coffee', '🧑‍🍳', ['ʁ']),
  cestBon: fr("c'est bon", 'is it good', '😋', ['ɔ̃']),
  çaVa: fr('comment ça va', 'how are you', '🙂', ['ɑ̃']),
  deQuelleCouleur: fr('le chat est noir', 'the cat is black', '🐱', ['ʁ']),
} satisfies Record<string, SpeakItem>;

const lesson = (id: string, title: string, icon: string, kind: Lesson['kind'], exercises: Lesson['exercises']): Lesson => ({
  id, unitId: 'fr-cafe', title, icon, kind, exercises,
});

const W = FW;
const P = FP;

const cafeLessons: Lesson[] = [
  lesson('fr-cafe-1', 'Key words', '🥐', 'words', {
    little: [speak(W.pain), speak(W.eau), heard(W.eau, W.pain, W.pomme), speak(W.pomme), speak(W.chat), speak(W.rouge)],
    junior: [speak(W.croissant), speak(W.jus), heard(W.jus, W.croissant, W.gâteau), speak(W.gâteau), speak(W.fromage), speak(W.chocolat)],
    teen: [speak(W.croissant), speak(W.fromage), heard(W.poisson, W.poulet, W.salade), speak(W.poisson), speak(W.sucre), speak(W.soupe)],
  }),
  lesson('fr-cafe-2', 'Useful phrases', '💬', 'phrases', {
    little: [speak(P.bonjour), speak(P.merci), heard(P.merci, P.bonjour, P.auRevoir), speak(P.auRevoir), speak(P.oui)],
    junior: [speak(P.unCafé), speak(P.silVousPlaît), heard(P.unCroissant, P.unCafé, P.deuxCafés), speak(P.unCroissant), speak(P.jaimeLeChocolat)],
    teen: [speak(P.jeVoudraisUnCafé), speak(P.lAddition), heard(P.trèsBien, P.commentÇaVa, P.cestTrèsBon), speak(P.commentÇaVa), speak(P.trèsBien)],
  }),
  lesson('fr-cafe-3', 'The French u and r', '👄', 'pronunciation', {
    little: [speak(W.rouge), speak(W.riz), pair(W.tu, W.vous, 0, 'y'), speak(W.tu), speak(W.jour)],
    junior: [pair(W.tu, W.vous, 0, 'y'), speak(W.sucre), speak(W.rue), speak(W.jus), speak(P.unPeuDeSucre)],
    teen: [pair(W.tu, W.vous, 0, 'y'), speak(W.rue), speak(W.sucre), speak(P.unPeuDeSucre), speak(P.jeVoudraisUnCroissant)],
  }),
  lesson('fr-cafe-4', 'Sounds in the nose', '👃', 'pronunciation', {
    little: [speak(W.pain), speak(W.bon), speak(W.blanc), pair(W.bon, W.blancPair, 0, 'ɔ̃'), speak(W.un)],
    junior: [pair(W.bon, W.blancPair, 0, 'ɔ̃'), speak(W.croissant), speak(W.poisson), speak(W.maison), speak(P.unChienBlanc)],
    teen: [pair(W.bon, W.blancPair, 1, 'ɑ̃'), speak(W.montagne), speak(P.cestTrèsBon), speak(P.lAddition), speak(W.poisson)],
  }),
  lesson('fr-cafe-5', 'Say what you see', '🗣️', 'speaking', {
    little: [speak(W.pomme, 'image'), speak(W.chat, 'image'), speak(W.bleu, 'image'), speak(W.fleur, 'image')],
    junior: [speak(W.croissant, 'image'), speak(W.gâteau, 'image'), speak(W.chien, 'image'), speak(W.livre, 'image')],
    teen: [speak(W.fromage, 'image'), speak(W.poisson, 'image'), speak(W.montagne, 'image'), speak(W.sucre, 'image')],
  }),
  lesson('fr-cafe-6', 'At the café', '☕', 'conversation', {
    little: [dialogue(T.bonjour, '👋', P.bonjour, P.salut), dialogue(T.deQuelleCouleur, '🐱', P.oui, P.non), dialogue(P.auRevoir, '👋', P.auRevoir)],
    junior: [dialogue(T.vousDésirez, '🧑‍🍳', P.unCafé, P.unCroissant), dialogue(T.cestBon, '😋', P.oui, P.cestTrèsBon), dialogue(T.bonjour, '🛎️', P.merci)],
    teen: [dialogue(T.vousDésirez, '🧑‍🍳', P.jeVoudraisUnCafé, P.deLEau), dialogue(T.çaVa, '🙂', P.trèsBien, P.cestTrèsBon), dialogue(T.cestBon, '🧾', P.lAddition)],
  }),
  lesson('fr-cafe-7', 'Review', '🏆', 'review', {
    little: [speak(W.pomme, 'image'), speak(P.bonjour), speak(W.rouge), speak(P.merci)],
    junior: [speak(P.unCroissant), speak(W.sucre), speak(P.jaimeLeChocolat), speak(P.silVousPlaît)],
    teen: [speak(P.jeVoudraisUnCafé), speak(P.lAddition), speak(P.cestTrèsBon), speak(W.montagne)],
  }),
];

const lockedUnit = (id: string, title: string, subtitle: string, icon: string, color: string, grownUp?: Unit['grownUp']): Unit => ({ id, title, subtitle, icon, color, lessons: [], locked: true, grownUp });

const FR_BASE: Course = {
  id: 'french-adventure',
  title: 'French Adventure',
  grownUpTitle: 'French',
  language: 'fr',
  units: [
    {
      id: 'fr-cafe', title: 'At the Café ☕', subtitle: 'Order, ask and say thank you in French', icon: '🥐', color: 'var(--coral)',
      lessons: cafeLessons, grownUp: { title: 'Café & Everyday French', subtitle: 'Order, ask and be understood' },
    },
    lockedUnit('fr-out', 'Out and About 🚇', 'Asking the way, buying a ticket', '🗺️', 'var(--sky)', { title: 'Getting Around', subtitle: 'Directions, tickets and timetables' }),
    lockedUnit('fr-people', 'People 👨‍👩‍👧', 'Family, friends and introductions', '👋', 'var(--leaf)', { title: 'People & Small Talk', subtitle: 'Introduce yourself and keep a conversation going' }),
    lockedUnit('fr-work', 'At Work 💼', 'Meetings, email and the phone', '💼', 'var(--sun)', { title: 'Work French', subtitle: 'Meetings, email and the telephone' }),
  ],
};

/** Short speaking check the first time someone opens the French course. */
export const FR_CHECK_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = {
  little: [W.rouge, W.pain, P.bonjour],
  junior: [W.sucre, P.unCroissant, W.bleu],
  teen: [W.rue, P.jeVoudraisUnCafé, W.montagne],
};

// ---------- Pronunciation Lab: sound → syllables → words → phrases → sentence ----------
type Ladder = Record<LabStage, SpeakItem[]>;
const L = (syllables: SpeakItem[], words: SpeakItem[], phrases: SpeakItem[], sentence: SpeakItem): Ladder => ({ syllables, words, phrases, sentence: [sentence] });

export const FR_LADDERS: Record<PhonemeId, Ladder> = {
  y: L([W.tu, W.jus, W.rue], [W.sucre, W.rue, W.jus], [P.unPeuDeSucre, P.deuxCafés], P.jeVoudraisUnCroissant),
  ʁ: L([W.riz, W.rue, W.rouge], [W.fromage, W.livre, W.frère], [P.laFleurRouge, P.unCroissant], P.jeVoudraisUnCafé),
  'ɑ̃': L([W.blanc, W.croissant, W.montagne], [W.croissant, W.blanc, W.montagne], [P.unChienBlanc, P.commentÇaVa], P.jeVoudraisUnCroissant),
  'ɛ̃': L([W.pain, W.un, W.chien], [W.pain, W.chien, W.cinq], [P.unCafé, P.unChienBlanc], P.trèsBien),
  'ɔ̃': L([W.bon, W.poisson, W.maison], [W.poisson, W.maison, W.montagne], [P.cestTrèsBon, P.lAddition], P.cestTrèsBon),
  ø: L([W.deux, W.peu, W.bleu], [W.bleu, W.deux, W.peu], [P.deuxCafés, P.unPeuDeSucre], P.unPeuDeSucre),
  œ: L([W.sœur, W.fleur, W.neuf], [W.fleur, W.sœur, W.neuf], [P.laFleurRouge, P.laFleurRouge], P.laFleurRouge),
  ʒ: L([W.jus, W.jour, W.rouge], [W.fromage, W.jaune, W.jour], [P.jaimeLeChocolat, P.laFleurRouge], P.jaimeLeChocolat),
  ɲ: L([W.montagne, W.montagne, W.montagne], [W.montagne, W.maison, W.bon], [P.cestTrèsBon, P.commentÇaVa], P.cestTrèsBon),
};

export const FR_LAB_SOUNDS: PhonemeId[] = ['y', 'ʁ', 'ɑ̃', 'ɛ̃', 'ɔ̃', 'ø', 'œ', 'ʒ', 'ɲ'];

/** Every French item, for indexing and for the accuracy test set. */
const FR_BASE_ITEMS: SpeakItem[] = [...new Map([...Object.values(FW), ...Object.values(FP), ...Object.values(T)].map((it) => [it.id, it])).values()];
const FR_EXPANDED = addCommunication(FR_BASE, FR_BASE_ITEMS);
export const FR_COURSE: Course = FR_EXPANDED.course;
export const FR_ITEMS: SpeakItem[] = FR_EXPANDED.items;

/** Every distinct word the course says aloud — the lexicon has to know all of them. */
export const FR_COURSE_WORDS: string[] = [
  ...new Set(FR_ITEMS.flatMap((it) => it.text.split(/\s+/).map((w) => w.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '')).filter(Boolean))),
];

/** True when every word of an item is in the lexicon, so its sounds can be named. */
export const frFullyKnown = (item: SpeakItem): boolean =>
  // Words only: French sets ! and ? apart with a space ("Merci !"), and a lone mark is not a word to look up.
  frTokenize(item.text).every((w) => frWordPhones(w).syllables.some((s) => s.phonemes.length));
