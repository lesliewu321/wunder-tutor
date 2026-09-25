import type { ContentBand, CourseId, SpeakItem } from '../domain/types';
import { tc } from '../i18n';
import { FR_SCENARIOS } from './fr/scenarios';
import { JA_SCENARIOS } from './ja/scenarios';
import { KO_SCENARIOS } from './ko/scenarios';
import { ES_SCENARIOS } from './es/scenarios';
import { ZH_SCENARIOS } from './zh/scenarios';

type ByBand<T> = Record<ContentBand, T>;

/** One exchange: what the tutor says, and what the learner may say back (each a line to speak and be scored on). */
export interface ScenarioTurn {
  tutor: ByBand<SpeakItem>;
  replies: ByBand<SpeakItem[]>;
}

/**
 * A role-play in the language of one course. The lines are speakable items in that language, so a Putonghua
 * conversation is spoken by the Mandarin voice, scored in Mandarin with its tones, and shown in the learner's
 * characters with pinyin — exactly as its lessons are. `setting`, `tutorRole` and `goals` brief the live tutor.
 */
export interface Scenario {
  id: string;
  course: CourseId;
  title: string;
  icon: string;
  color: string;
  blurb: ByBand<string>;
  setting: string;
  tutorRole: string;
  goals: string[];
  turns: ScenarioTurn[];
  closing: ByBand<SpeakItem>;
}

/** An English conversation line, with the id English lines have always had, so a learner's history still matches. */
export const sayLine = (text: string): SpeakItem => ({ id: `say-${text.toLowerCase().replace(/[^a-z]+/g, '-')}`, text, kind: 'sentence' });

const byBand = <A, B>(v: ByBand<A>, f: (a: A) => B): ByBand<B> => ({ little: f(v.little), junior: f(v.junior), teen: f(v.teen) });

/** The English scenarios are written as plain text below and turned into lines here. */
interface TextScenario extends Omit<Scenario, 'course' | 'turns' | 'closing'> {
  turns: { tutor: ByBand<string>; replies: ByBand<string[]> }[];
  closing: ByBand<string>;
}
const english = (s: TextScenario): Scenario => ({
  ...s, course: 'en',
  turns: s.turns.map((t) => ({ tutor: byBand(t.tutor, sayLine), replies: byBand(t.replies, (r) => r.map(sayLine)) })),
  closing: byBand(s.closing, sayLine),
});

const same = (s: string): ByBand<string> => ({ little: s, junior: s, teen: s });

const EN_SCENARIOS: Scenario[] = ([
  {
    id: 'cafe', title: 'The Wunder Café', icon: '☕', color: 'var(--coral)',
    blurb: { little: 'Ask for yummy food!', junior: 'Order a snack and a drink.', teen: 'Order a meal and chat with the waiter.' },
    setting: 'A friendly café. The child is a customer ordering food and drink.',
    tutorRole: 'a cheerful café waiter',
    goals: ['greet', 'order a drink', 'order food', 'say thank you'],
    turns: [
      {
        tutor: { little: 'Hello! Are you hungry?', junior: 'Hello! Welcome to the café. Are you hungry today?', teen: 'Hi there, welcome in! Are you hungry, or just thirsty today?' },
        replies: { little: ['Yes, please.', 'Hello!'], junior: ['Yes, I am very hungry.', 'I am a little hungry.'], teen: ["I'm very hungry, actually.", "I'm just thirsty, thank you."] },
      },
      {
        tutor: { little: 'What would you like to drink?', junior: 'Great! What would you like to drink?', teen: 'No problem. What can I get you to drink?' },
        replies: { little: ['Milk, please.', 'Water, please.'], junior: ['Can I have some water, please?', 'I would like some orange juice.'], teen: ['I would like a cup of hot chocolate.', 'Could I have some water, please?'] },
      },
      {
        tutor: { little: 'And to eat?', junior: 'Good choice! And what would you like to eat?', teen: 'Coming right up. Would you like something to eat with that?' },
        replies: { little: ['An apple, please.', 'Bread, please.'], junior: ['I would like a cheese sandwich.', 'I would like an apple.'], teen: ["I think I'll have the fish.", 'What do you recommend?'] },
      },
      {
        tutor: { little: 'Here you are!', junior: 'Here you are. Enjoy your food!', teen: 'Here you go — three minutes, just like I promised. Enjoy!' },
        replies: { little: ['Thank you!'], junior: ['Thank you very much.'], teen: ['That sounds great, thank you.', 'Thank you very much.'] },
      },
    ],
    closing: { little: 'Bye-bye! Come back soon!', junior: 'Goodbye! Come back soon!', teen: 'Thanks for coming in. See you next time!' },
  },
  {
    id: 'zoo', title: 'A Day at the Zoo', icon: '🦁', color: 'var(--leaf)',
    blurb: { little: 'Say hello to the animals!', junior: 'Talk about the animals you see.', teen: 'Plan your zoo visit with a guide.' },
    setting: 'The entrance of a zoo. The child is a visitor talking to a zoo guide about animals.',
    tutorRole: 'a friendly zoo guide',
    goals: ['greet', 'name animals', 'say what you like', 'say goodbye'],
    turns: [
      {
        tutor: { little: 'Hello! Welcome to the zoo!', junior: 'Hello and welcome to the zoo! Do you like animals?', teen: 'Welcome to the zoo! Is this your first visit?' },
        replies: { little: ['Hello!', 'Hi!'], junior: ['Yes, I love animals.', 'I like animals very much.'], teen: ['Yes, this is my first visit.', 'No, I love to visit the zoo.'] },
      },
      {
        tutor: { little: 'Look! What is it?', junior: 'Look over there! What can you see?', teen: 'We have three new arrivals this month. What would you like to see first?' },
        replies: { little: ['A lion!', 'A monkey!'], junior: ['I can see three lions.', 'I can see a little monkey.'], teen: ['I would like to see the lions.', 'I think the monkeys are right there.'] },
      },
      {
        tutor: { little: 'Do you like it?', junior: 'Wow! Which animal is your favourite?', teen: 'Good choice. Which animal do you think is the most interesting?' },
        replies: { little: ['Yes! I like it.', 'I love it!'], junior: ['My favourite animal is the lion.', 'I like the monkeys.'], teen: ['I think the lions are very interesting.', 'My favourite animal is the monkey.'] },
      },
      {
        tutor: { little: 'Time to go. Bye-bye!', junior: 'The zoo is closing now. Did you have fun?', teen: 'We’re closing soon. Did you enjoy your visit?' },
        replies: { little: ['Bye-bye!', 'Thank you!'], junior: ['Yes! Thank you very much.', 'Yes, it was great.'], teen: ['Yes, it was great, thank you.', 'I loved it. Thank you very much.'] },
      },
    ],
    closing: same('Thank you for visiting. Goodbye!'),
  },
  {
    id: 'friend', title: 'A New Friend', icon: '🎈', color: 'var(--sky)',
    blurb: { little: 'Say hi and play!', junior: 'Meet a new friend at the park.', teen: 'Make small talk with someone new.' },
    setting: 'A park. The child meets a friendly character called Robin and talks about favourite things (never real personal details).',
    tutorRole: 'Robin, a friendly kid at the park',
    goals: ['greet', 'talk about favourite things', 'suggest playing', 'say goodbye'],
    turns: [
      {
        tutor: { little: 'Hi! I am Robin!', junior: 'Hi! I’m Robin. It’s nice to meet you!', teen: 'Hey! I’m Robin. I don’t think we’ve met before.' },
        replies: { little: ['Hello, Robin!', 'Hi!'], junior: ['Hello, Robin! Nice to meet you.', 'Hi, Robin!'], teen: ['Hi Robin, nice to meet you.', "Hello! No, I don't think so."] },
      },
      {
        tutor: { little: 'I like red. Do you like red?', junior: 'My favourite colour is red. What is your favourite colour?', teen: 'I’m really into football. What do you like to do for fun?' },
        replies: { little: ['Yes, I like red.', 'I like yellow.'], junior: ['My favourite colour is yellow.', 'I like red too.'], teen: ['I really like to play football too.', 'I love to read and draw.'] },
      },
      {
        tutor: { little: 'Let’s play!', junior: 'Cool! Do you want to play with me?', teen: 'Nice! We’re playing over there. Want to join us?' },
        replies: { little: ['Yes, please!', 'Let’s play!'], junior: ['Yes! That sounds great.', 'Yes, I would like to play.'], teen: ['That sounds great, thank you.', 'I would love to. Thank you!'] },
      },
    ],
    closing: { little: 'That was fun! Bye-bye!', junior: 'That was fun! See you tomorrow!', teen: 'That was fun. See you around!' },
  },
] satisfies TextScenario[]).map(english);

/** Every conversation, each in its course's language. */
export const SCENARIOS: Scenario[] = [...EN_SCENARIOS, ...ZH_SCENARIOS, ...FR_SCENARIOS, ...JA_SCENARIOS, ...KO_SCENARIOS, ...ES_SCENARIOS];

/** The conversations for the course being learned: a Putonghua learner talks in Putonghua. */
export const scenariosFor = (course: CourseId): Scenario[] => SCENARIOS.filter((s) => s.course === course);


export const findScenario = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

/**
 * A scenario's name and blurb in the app's language (`scenario.<id>.title`, `scenario.<id>.blurb.<band>`). Only what
 * the screens show: the conversation itself — and the title, setting and role the tutor is briefed with — stays in
 * the language being practised, so the tutor goes on reading the properties above.
 */
export const scenarioTitle = (s: Pick<Scenario, 'id' | 'title'>): string => tc(`scenario.${s.id}.title`, s.title);
export const scenarioBlurb = (s: Pick<Scenario, 'id' | 'blurb'>, band: ContentBand): string => tc(`scenario.${s.id}.blurb.${band}`, s.blurb[band]);
