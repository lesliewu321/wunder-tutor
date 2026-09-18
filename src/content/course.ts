import type { Course, Exercise, Lesson, PhonemeId, SpeakItem, Unit } from '../domain/types';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const kindOf = (text: string): SpeakItem['kind'] => {
  const words = text.trim().split(/\s+/).length;
  if (words === 1) return 'word';
  return /[.?!]$/.test(text.trim()) && words > 3 ? 'sentence' : 'phrase';
};

/** Item ids are derived from the text so the same phrase shares progress wherever it appears. */
export const item = (text: string, picture?: string, meaning?: string, focus?: PhonemeId[]): SpeakItem => ({
  id: `it-${slug(text)}`, text, picture, meaning, focus, kind: kindOf(text),
});

let n = 0;
const speak = (it: SpeakItem, prompt: 'text' | 'image' | 'translation' = 'text'): Exercise => ({ id: `ex-${++n}`, type: 'speak', item: it, prompt });
const heard = (answer: SpeakItem, ...others: SpeakItem[]): Exercise => ({ id: `ex-${++n}`, type: 'choose-heard', answer, options: [answer, ...others] });
const pair = (a: SpeakItem, b: SpeakItem, answerIndex: 0 | 1, focus: PhonemeId): Exercise => ({ id: `ex-${++n}`, type: 'minimal-pair', pair: [a, b], answerIndex, focus });
const dialogue = (tutorLine: string, picture: string, ...replies: SpeakItem[]): Exercise => ({ id: `ex-${++n}`, type: 'dialogue', tutorLine, replies, picture });

// ---------- Vocabulary ----------
const W = {
  apple: item('apple', '🍎', 'a round red or green fruit', ['æ']),
  milk: item('milk', '🥛', 'a white drink', ['ɪ', 'l']),
  bread: item('bread', '🍞', 'you make toast with it', ['r']),
  water: item('water', '💧', 'a clear drink', ['w']),
  banana: item('banana', '🍌', 'a long yellow fruit', ['æ']),
  cheese: item('cheese', '🧀', 'yellow food made from milk', ['tʃ', 'z']),
  chicken: item('chicken', '🍗', 'meat from a bird', ['tʃ', 'ɪ']),
  juice: item('orange juice', '🧃', 'a sweet drink made from oranges', ['r', 'dʒ']),
  sandwich: item('sandwich', '🥪', 'two slices of bread with food inside', ['æ', 'w']),
  breakfast: item('breakfast', '🍳', 'the first meal of the day', ['r']),
  vegetables: item('vegetables', '🥦', 'plants you eat, like carrots and broccoli', ['v', 'dʒ']),
  chocolate: item('chocolate', '🍫', 'a sweet brown treat', ['tʃ', 'l']),
  restaurant: item('restaurant', '🍽️', 'a place where you pay to eat a meal', ['r']),
  three: item('three', '3️⃣', 'the number 3', ['θ', 'r']),
  tree: item('tree', '🌳', 'a tall plant with leaves', ['r']),
  red: item('red', '🔴', 'the colour of a tomato', ['r']),
  think: item('think', '💭', 'to use your mind', ['θ']),
  sink: item('sink', '🚰', 'where you wash your hands', ['s']),
  thirsty: item('thirsty', '🥵', 'when you need a drink', ['θ']),
  fries: item('fries', '🍟', 'thin fried potatoes', ['r']),
  flies: item('flies', '🪰', 'small flying insects', ['l']),
  ship: item('ship', '🚢', 'a big boat', ['ɪ']),
  sheep: item('sheep', '🐑', 'a woolly farm animal', ['i']),
  very: item('very', '⭐', 'a lot', ['v']),
  berry: item('berry', '🫐', 'a small round fruit', ['b']),
  fish: item('fish', '🐟', 'an animal that swims — and a food', ['ɪ', 'ʃ']),
};

const P = {
  milkPlease: item('Milk, please.', '🥛', 'ask for milk politely', ['ɪ', 'z']),
  applePlease: item('An apple, please.', '🍎', 'ask for an apple politely', ['æ']),
  thankYou: item('Thank you!', '💛', 'say this when someone helps you', ['θ']),
  yesPlease: item('Yes, please.', '👍', 'a polite way to say yes', ['z']),
  canIHave: item('Can I have some water, please?', '💧', 'ask for water politely', ['w', 'v']),
  wouldLikeApple: item('I would like an apple.', '🍎', 'a polite way to say what you want', ['w', 'l', 'æ']),
  thankYouVeryMuch: item('Thank you very much.', '💛', 'a big thank-you', ['θ', 'v']),
  hungry: item('I am very hungry.', '😋', 'you really need food', ['v', 'r']),
  hotChocolate: item('I would like a cup of hot chocolate.', '☕', 'order a warm drink politely', ['w', 'l', 'tʃ']),
  menu: item('Could I have the menu, please?', '📋', 'ask to see the list of food', ['ð', 'v']),
  recommend: item('What do you recommend?', '🤔', 'ask the waiter for a suggestion', ['w', 'r']),
  soundsGreat: item('That sounds great, thank you.', '😄', 'agree happily', ['ð', 'θ', 'r']),
  threeRedApples: item('three red apples', '🍎', 'count the apples', ['θ', 'r']),
  thinkFish: item("I think I'll have the fish.", '🐟', 'decide what to order', ['θ', 'ð']),
  freshVeg: item('very fresh vegetables', '🥦', 'describe healthy food', ['v', 'r']),
  imThirsty: item("I'm thirsty.", '🥵', 'you need a drink', ['θ']),
};

const lesson = (id: string, title: string, icon: string, kind: Lesson['kind'], exercises: Lesson['exercises']): Lesson => ({
  id, unitId: 'food', title, icon, kind, exercises,
});

const foodLessons: Lesson[] = [
  lesson('food-1', 'Key words', '🍎', 'words', {
    little: [speak(W.apple), speak(W.milk), heard(W.milk, W.apple, W.bread), speak(W.bread), speak(W.water), speak(W.banana)],
    junior: [speak(W.water), speak(W.cheese), heard(W.cheese, W.chicken, W.juice), speak(W.chicken), speak(W.juice), speak(W.sandwich)],
    teen: [speak(W.breakfast), speak(W.vegetables), heard(W.vegetables, W.breakfast, W.restaurant), speak(W.chocolate), speak(W.sandwich), speak(W.restaurant)],
  }),
  lesson('food-2', 'Useful phrases', '💬', 'phrases', {
    little: [speak(P.milkPlease), speak(P.applePlease), heard(P.applePlease, P.milkPlease), speak(P.thankYou), speak(P.yesPlease)],
    junior: [speak(P.wouldLikeApple), speak(P.canIHave), heard(P.canIHave, P.wouldLikeApple, P.hungry), speak(P.thankYouVeryMuch), speak(P.hungry)],
    teen: [speak(P.hotChocolate), speak(P.menu), heard(P.recommend, P.menu, P.soundsGreat), speak(P.recommend), speak(P.soundsGreat)],
  }),
  lesson('food-3', 'Tricky sounds', '👅', 'pronunciation', {
    little: [pair(W.three, W.tree, 0, 'θ'), speak(W.three), speak(W.red), speak(P.thankYou)],
    junior: [pair(W.think, W.sink, 0, 'θ'), speak(W.three), speak(W.thirsty), speak(P.threeRedApples), pair(W.fries, W.flies, 0, 'r')],
    teen: [pair(W.three, W.tree, 0, 'θ'), speak(W.thirsty), speak(P.thinkFish), pair(W.very, W.berry, 0, 'v'), speak(P.freshVeg)],
  }),
  lesson('food-4', 'Listen closely', '👂', 'listening', {
    little: [heard(W.banana, W.apple, W.bread), pair(W.fries, W.flies, 0, 'r'), heard(W.water, W.milk, W.banana), speak(W.fries)],
    junior: [pair(W.ship, W.sheep, 1, 'ɪ'), heard(W.sandwich, W.chicken, W.cheese), pair(W.fries, W.flies, 1, 'r'), speak(W.fries), heard(P.hungry, P.canIHave, P.thankYouVeryMuch)],
    teen: [pair(W.ship, W.sheep, 0, 'ɪ'), pair(W.think, W.sink, 1, 'θ'), heard(P.menu, P.recommend, P.hotChocolate), pair(W.fries, W.flies, 0, 'r'), speak(P.imThirsty)],
  }),
  lesson('food-5', 'Say what you see', '🗣️', 'speaking', {
    little: [speak(W.apple, 'image'), speak(W.milk, 'image'), speak(W.banana, 'image'), speak(W.water, 'image')],
    junior: [speak(W.cheese, 'image'), speak(P.wouldLikeApple, 'image'), speak(P.canIHave, 'translation'), speak(P.thankYouVeryMuch, 'translation')],
    teen: [speak(P.hotChocolate, 'translation'), speak(P.menu, 'translation'), speak(P.recommend, 'translation'), speak(P.soundsGreat, 'translation')],
  }),
  lesson('food-6', 'At the café', '☕', 'conversation', {
    little: [
      dialogue('Hello! What would you like?', '🧑‍🍳', P.milkPlease, P.applePlease),
      dialogue('Here you are!', '🍽️', P.thankYou),
      dialogue('Would you like a banana too?', '🍌', P.yesPlease),
    ],
    junior: [
      dialogue('Hello! Welcome to the Wunder Café. What would you like to drink?', '🧑‍🍳', P.canIHave, item('I would like some orange juice.', '🧃')),
      dialogue('Of course! And something to eat?', '🍽️', P.wouldLikeApple, item('I would like a cheese sandwich.', '🥪')),
      dialogue('Good choice. Are you very hungry today?', '😋', P.hungry, item('I am a little hungry.', '🙂')),
      dialogue('Here you are. Enjoy your food!', '🛎️', P.thankYouVeryMuch),
    ],
    teen: [
      dialogue('Good afternoon! Welcome to the Wunder Café. Are you ready to order?', '🧑‍🍳', P.menu, P.recommend),
      dialogue('The fish is very fresh today, and our hot chocolate is famous.', '🐟', P.thinkFish, P.hotChocolate),
      dialogue('Excellent choice. Would you like fresh vegetables with that?', '🥦', P.soundsGreat, item('No, thank you. Just the fish.', '🙅')),
      dialogue('Perfect. I’ll bring everything in three minutes.', '⏱️', item('Thank you very much.', '💛')),
    ],
  }),
  // Review is built dynamically by the learning engine (due items + weak sounds); this is the cold-start fallback.
  lesson('food-7', 'Review', '🏆', 'review', {
    little: [speak(W.apple, 'image'), speak(W.three), speak(P.thankYou), speak(P.milkPlease)],
    junior: [speak(W.thirsty), speak(P.wouldLikeApple), speak(P.canIHave), speak(P.threeRedApples)],
    teen: [speak(W.vegetables), speak(P.hotChocolate), speak(P.thinkFish), speak(P.soundsGreat)],
  }),
];

const lockedUnit = (id: string, title: string, subtitle: string, icon: string, color: string): Unit => ({
  id, title, subtitle, icon, color, lessons: [], locked: true,
});

export const COURSE: Course = {
  id: 'english-adventure',
  title: 'English Adventure',
  language: 'en',
  units: [
    { id: 'food', title: 'Yummy Food', subtitle: 'Order food and drinks', icon: '🍎', color: 'var(--coral)', lessons: foodLessons },
    lockedUnit('family', 'My Family', 'Talk about the people you love', '👨‍👩‍👧', 'var(--sky)'),
    lockedUnit('animals', 'Animal Friends', 'Pets, farms and the zoo', '🦁', 'var(--leaf)'),
    lockedUnit('school', 'At School', 'Classroom words and questions', '🎒', 'var(--sun)'),
  ],
};

export const ALL_LESSONS: Lesson[] = COURSE.units.flatMap((u) => u.lessons);
export const findLesson = (id: string): Lesson | undefined => ALL_LESSONS.find((l) => l.id === id);

export const ITEM_INDEX: Record<string, SpeakItem> = {};
for (const l of ALL_LESSONS) {
  for (const band of ['little', 'junior', 'teen'] as const) {
    for (const ex of l.exercises[band]) {
      const items = ex.type === 'speak' ? [ex.item] : ex.type === 'choose-heard' ? ex.options : ex.type === 'minimal-pair' ? ex.pair : ex.replies;
      for (const it of items) ITEM_INDEX[it.id] = it;
    }
  }
}

/** Onboarding speaking check: short, covers the classic trouble sounds (w, r, θ, æ, v, ɪ). */
export const ASSESSMENT_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = {
  little: [W.water, W.three, W.apple],
  junior: [W.water, W.three, item('very red', '🔴'), P.thankYou],
  teen: [W.thirsty, item('very red apples', '🍎'), item('I think this is the right ship.', '🚢')],
};
