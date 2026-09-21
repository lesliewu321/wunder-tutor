import type { Course, Exercise, Lesson, PhonemeId, SpeakItem, Unit } from '../../domain/types';
import type { LabStage } from '../lab';
import { moraCount, parseJa } from './kana';

// Japanese for everyone from five to grown-up, like the other courses, and on the same first topic — food — so a
// family learning together meets the same words (Leslie, 2026-09-21: "add japanese lessons for 5-adult").
//
// A five-year-old names food from pictures in kana (みず, パン, りんご) and says thank you; an eight-to-eleven-year-old
// asks for things (みずをください); a teenager or an adult gets a table, orders and asks for the bill, politely
// (ラーメンをおねがいします, おかいけいをおねがいします). Pronunciation is taught where Japanese is hard for a Hong Kong
// learner: the beats — long vowels (おじさん uncle / おじいさん grandpa), the small っ (きて come / きって stamp) and ん —
// and the flapped r, the buzzy z, and が/だ/ば, which Cantonese does not voice.
//
// Every item is written with its readings: {水|みず}をください. The text (with kanji) is what the scorer is sent and
// what an older learner reads with furigana; a five-year-old sees the kana; everyone sees romaji, where the spaces
// in the markup mark the words (mizu o kudasai). See kana.ts.

/** A Japanese speaking item from a line written with its readings. `focus` names the beats it is really here for. */
export const ja = (marked: string, meaning: string, picture?: string, focus?: PhonemeId[]): SpeakItem => {
  const { text, ja: reading } = parseJa(marked);
  const beats = moraCount(reading.kana);
  const ascii = reading.romaji.toLowerCase().replace(/ā/g, 'aa').replace(/ū/g, 'uu').replace(/ē/g, 'ee').replace(/ō/g, 'oo');
  return {
    id: `ja-${ascii.replace(/[^a-z']+/g, '-').replace(/^-|-$/g, '')}${/[。！？]$/.test(text) ? '-s' : ''}`,
    text, lang: 'ja-JP', ja: reading, picture, meaning, focus,
    kind: beats <= 5 && !/[、。！？\s]/.test(text) ? 'word' : /[。！？]$/.test(text) && beats > 8 ? 'sentence' : 'phrase',
  };
};

let n = 0;
const speak = (it: SpeakItem, prompt: 'text' | 'image' = 'text'): Exercise => ({ id: `jx-${++n}`, type: 'speak', item: it, prompt });
const heard = (answer: SpeakItem, ...others: SpeakItem[]): Exercise => ({ id: `jx-${++n}`, type: 'choose-heard', answer, options: [answer, ...others] });
const pair = (a: SpeakItem, b: SpeakItem, answerIndex: 0 | 1, focus: PhonemeId): Exercise => ({ id: `jx-${++n}`, type: 'minimal-pair', pair: [a, b], answerIndex, focus });
const dialogue = (tutor: SpeakItem, picture: string, ...replies: SpeakItem[]): Exercise => ({ id: `jx-${++n}`, type: 'dialogue', tutorLine: tutor.text, tutor, replies, picture });

// ---------- Words ----------
export const JW = {
  // Food and drink
  mizu: ja('{水|みず}', 'water', '💧', ['ja:z']),
  ocha: ja('お{茶|ちゃ}', 'green tea', '🍵'),
  gyuunyuu: ja('{牛乳|ぎゅうにゅう}', 'milk', '🥛', ['ja:long', 'ja:voiced']),
  juusu: ja('ジュース', 'juice', '🧃', ['ja:long', 'ja:z']),
  pan: ja('パン', 'bread', '🍞', ['ja:N']),
  gohan: ja('ご{飯|はん}', 'rice', '🍚', ['ja:voiced', 'ja:N']),
  sushi: ja('すし', 'sushi', '🍣'),
  raamen: ja('ラーメン', 'ramen', '🍜', ['ja:r', 'ja:long', 'ja:N']),
  ringo: ja('りんご', 'apple', '🍎', ['ja:r', 'ja:N']),
  banana: ja('バナナ', 'banana', '🍌', ['ja:voiced']),
  ichigo: ja('いちご', 'strawberry', '🍓', ['ja:voiced']),
  keeki: ja('ケーキ', 'cake', '🍰', ['ja:long']),
  tamago: ja('{卵|たまご}', 'egg', '🥚', ['ja:voiced']),
  sakana: ja('{魚|さかな}', 'fish', '🐟'),
  onigiri: ja('おにぎり', 'rice ball', '🍙', ['ja:voiced', 'ja:r']),
  gyouza: ja('ぎょうざ', 'dumplings', '🥟', ['ja:voiced', 'ja:long', 'ja:z']),
  tenpura: ja('てんぷら', 'tempura', '🍤', ['ja:N', 'ja:r']),
  mikan: ja('みかん', 'mandarin orange', '🍊', ['ja:N']),
  suupu: ja('スープ', 'soup', '🍲', ['ja:long']),
  koohii: ja('コーヒー', 'coffee', '☕', ['ja:long']),
  aisukuriimu: ja('アイスクリーム', 'ice cream', '🍦', ['ja:r', 'ja:long']),
  chokoreeto: ja('チョコレート', 'chocolate', '🍫', ['ja:r', 'ja:long']),
  kyuuri: ja('きゅうり', 'cucumber', '🥒', ['ja:y', 'ja:long', 'ja:r']),
  toufu: ja('とうふ', 'tofu', '🧈', ['ja:long', 'ja:f']),

  // Pairs whose only difference is a beat — the heart of Japanese pronunciation.
  obasan: ja('おばさん', 'aunt', '👩', ['ja:voiced']),
  obaasan: ja('おばあさん', 'grandma', '👵', ['ja:long']),
  ojisan: ja('おじさん', 'uncle', '👨', ['ja:z']),
  ojiisan: ja('おじいさん', 'grandpa', '👴', ['ja:long']),
  kite: ja('きて', 'come here', '👋'),
  kitte: ja('{切手|きって}', 'stamp', '✉️', ['ja:Q']),
  yuki: ja('{雪|ゆき}', 'snow', '❄️'),
  yuuki: ja('{勇気|ゆうき}', 'courage', '💪', ['ja:long']),

  // Around us, for the sound ladders
  ii: ja('いい', 'good', '👍', ['ja:long']),
  zou: ja('ぞう', 'elephant', '🐘', ['ja:z', 'ja:long']),
  koori: ja('こおり', 'ice', '🧊', ['ja:long', 'ja:r']),
  chotto: ja('ちょっと', 'a little', '🤏', ['ja:Q']),
  motto: ja('もっと', 'more', '➕', ['ja:Q']),
  kippu: ja('きっぷ', 'ticket', '🎫', ['ja:Q']),
  zasshi: ja('ざっし', 'magazine', '📰', ['ja:Q', 'ja:z']),
  gakkou: ja('{学校|がっこう}', 'school', '🏫', ['ja:voiced', 'ja:Q', 'ja:long']),
  hon: ja('{本|ほん}', 'book', '📖', ['ja:N']),
  en: ja('{円|えん}', 'yen', '💴', ['ja:N']),
  densha: ja('{電車|でんしゃ}', 'train', '🚃', ['ja:voiced', 'ja:N']),
  risu: ja('りす', 'squirrel', '🐿️', ['ja:r']),
  tori: ja('{鳥|とり}', 'bird', '🐦', ['ja:r']),
  hare: ja('はれ', 'sunny', '☀️', ['ja:r']),
  kuruma: ja('{車|くるま}', 'car', '🚗', ['ja:r']),
  sakura: ja('さくら', 'cherry blossom', '🌸', ['ja:r']),
  tsuki: ja('{月|つき}', 'moon', '🌙', ['ja:ts']),
  natsu: ja('{夏|なつ}', 'summer', '🏖️', ['ja:ts']),
  kutsu: ja('{靴|くつ}', 'shoes', '👟', ['ja:ts']),
  tsukue: ja('つくえ', 'desk', '🪑', ['ja:ts']),
  itsutsu: ja('いつつ', 'five things', '5️⃣', ['ja:ts']),
  mittsu: ja('みっつ', 'three things', '3️⃣', ['ja:Q', 'ja:ts']),
  fune: ja('{船|ふね}', 'boat', '⛵', ['ja:f']),
  fuku: ja('{服|ふく}', 'clothes', '👕', ['ja:f']),
  fuyu: ja('{冬|ふゆ}', 'winter', '⛄', ['ja:f']),
  fuusen: ja('ふうせん', 'balloon', '🎈', ['ja:f', 'ja:long', 'ja:N']),
  saifu: ja('さいふ', 'wallet', '👛', ['ja:f']),
  kaze: ja('{風|かぜ}', 'wind', '🌬️', ['ja:z']),
  jitensha: ja('じてんしゃ', 'bicycle', '🚲', ['ja:z', 'ja:N']),
  doa: ja('ドア', 'door', '🚪', ['ja:voiced']),
  basu: ja('バス', 'bus', '🚌', ['ja:voiced']),
  gomu: ja('ゴム', 'rubber band', '➰', ['ja:voiced']),
  kyuu: ja('きゅう', 'nine', '9️⃣', ['ja:y', 'ja:long']),
  kyou: ja('{今日|きょう}', 'today', '📅', ['ja:y', 'ja:long']),
  hyaku: ja('{百|ひゃく}', 'a hundred', '💯', ['ja:y']),
  nyaa: ja('にゃあ', 'miaow', '🐱', ['ja:y', 'ja:long']),
} satisfies Record<string, SpeakItem>;

// ---------- Phrases and sentences ----------
export const JP = {
  konnichiwa: ja('こんにち{は|わ}', 'hello', '👋', ['ja:N']),
  arigatou: ja('ありがとう', 'thank you', '🙏', ['ja:r', 'ja:long']),
  arigatouGozaimasu: ja('ありがとう ございます', 'thank you very much', '🙏', ['ja:r', 'ja:long', 'ja:voiced']),
  kudasai: ja('ください', 'please (give me)', '🤲', ['ja:voiced']),
  onegaishimasu: ja('お{願|ねが}い します', 'please', '🙏', ['ja:voiced']),
  itadakimasu: ja('いただきます', 'let’s eat', '🙏', ['ja:voiced']),
  gochisousama: ja('ごちそうさま', 'thanks for the meal', '😊', ['ja:voiced', 'ja:long']),
  gochisousamaDeshita: ja('ごちそうさま でした', 'thank you for the meal', '😊', ['ja:voiced', 'ja:long']),
  oishii: ja('おいしい！', 'yummy!', '😋', ['ja:long']),
  oishiiDesu: ja('おいしい です！', 'it’s tasty!', '😋', ['ja:long']),
  totemoOishii: ja('とても おいしい です。', 'it’s very tasty', '😋', ['ja:long']),
  hai: ja('はい', 'yes', '✅'),
  iie: ja('いいえ', 'no', '❌', ['ja:long']),
  ringoKudasai: ja('りんご、ください', 'an apple, please', '🍎', ['ja:r', 'ja:N']),
  mizuKudasai: ja('みず、ください', 'water, please', '💧', ['ja:z']),
  mizuWo: ja('{水|みず} を ください', 'water, please', '💧', ['ja:z']),
  ochaWo: ja('お{茶|ちゃ} を ください', 'green tea, please', '🍵'),
  juusuWo: ja('ジュース を ください', 'juice, please', '🧃', ['ja:long', 'ja:z']),
  sushiWo: ja('すし を ください', 'sushi, please', '🍣'),
  onigiriWo: ja('おにぎり を ください', 'a rice ball, please', '🍙', ['ja:voiced', 'ja:r']),
  gohanWo: ja('ご{飯|はん} を ください', 'rice, please', '🍚', ['ja:voiced', 'ja:N']),
  mottoKudasai: ja('もっと ください', 'more, please', '➕', ['ja:Q']),
  hitotsuKudasai: ja('ひとつ ください', 'one, please', '☝️', ['ja:ts']),
  futatsuKudasai: ja('ふたつ ください', 'two, please', '✌️', ['ja:f', 'ja:ts']),
  ringoGaSuki: ja('りんご が {好|す}き です。', 'I like apples.', '🍎', ['ja:r', 'ja:voiced']),
  sushiGaSuki: ja('すし が {好|す}き です。', 'I like sushi.', '🍣', ['ja:voiced']),
  raamenWo: ja('ラーメン を お{願|ねが}い します。', 'Ramen, please.', '🍜', ['ja:r', 'ja:long', 'ja:N']),
  gyouzaWo: ja('ぎょうざ を お{願|ねが}い します。', 'Dumplings, please.', '🥟', ['ja:voiced', 'ja:long', 'ja:z']),
  onakaGaSuita: ja('おなか が すきました。', 'I’m hungry.', '😋', ['ja:voiced']),
  ikuraDesuka: ja('いくら です か？', 'How much is it?', '💴', ['ja:r']),
  koreWo: ja('これ を ください。', 'This one, please.', '👉', ['ja:r']),
  okaikei: ja('お{会計|かいけい} を お{願|ねが}い します。', 'The bill, please.', '🧾', ['ja:voiced']),
  hitoriDesu: ja('ひとり です。', 'Just one.', '☝️', ['ja:r']),
  futariDesu: ja('ふたり です。', 'Two of us.', '✌️', ['ja:f', 'ja:r']),
  chottoMatte: ja('ちょっと {待|ま}って', 'wait a moment', '✋', ['ja:Q']),
  natsuWaAtsui: ja('{夏|なつ} {は|わ} あつい です。', 'Summer is hot.', '🏖️', ['ja:ts']),
  mizuToJuusu: ja('{水|みず} と ジュース を ください。', 'Water and juice, please.', '🧃', ['ja:z', 'ja:long']),
  kyuuriWo: ja('きゅうり を ください', 'a cucumber, please', '🥒', ['ja:y', 'ja:long', 'ja:r']),
  kyouWaHare: ja('{今日|きょう} {は|わ} はれ です。', 'It’s sunny today.', '☀️', ['ja:y', 'ja:r']),
  fuusenGaFutatsu: ja('ふうせん が ふたつ あります。', 'There are two balloons.', '🎈', ['ja:f', 'ja:long']),
  sakuraGaKirei: ja('さくら が きれい です。', 'The cherry blossoms are lovely.', '🌸', ['ja:r']),
  densha_de: ja('{電車|でんしゃ} で {学校|がっこう} に {行|い}きます。', 'I go to school by train.', '🚃', ['ja:voiced', 'ja:Q', 'ja:N']),
} satisfies Record<string, SpeakItem>;

/** What the teacher says first in a dialogue. */
const T = {
  nanigaii: ja('なに が いい？', 'What would you like?', '🧑‍🍳'),
  douzo: ja('はい、どうぞ！', 'Here you are!', '🍽️', ['ja:long', 'ja:z']),
  oishii: ja('おいしい？', 'Is it yummy?', '😋', ['ja:long']),
  naniWoNomimasuka: ja('{何|なに} を {飲|の}みます か？', 'What would you like to drink?', '🧑‍🍳'),
  naniWoTabemasuka: ja('{何|なに} を {食|た}べます か？', 'What would you like to eat?', '🧑‍🍳', ['ja:voiced']),
  oishiiDesuka: ja('おいしい です か？', 'Is it tasty?', '😋', ['ja:long']),
  irasshaimase: ja('いらっしゃいませ！', 'Welcome!', '🧑‍🍳', ['ja:r', 'ja:Q']),
  nanmeisama: ja('いらっしゃいませ！ {何名|なんめい}さま です か？', 'Welcome! How many of you?', '🧑‍🍳', ['ja:N']),
} satisfies Record<string, SpeakItem>;

const lesson = (id: string, title: string, icon: string, kind: Lesson['kind'], exercises: Lesson['exercises']): Lesson => ({
  id, unitId: 'ja-food', title, icon, kind, exercises,
});

const W = JW;
const P = JP;

const foodLessons: Lesson[] = [
  lesson('ja-food-1', 'Key words', '🍎', 'words', {
    little: [speak(W.mizu), speak(W.pan), heard(W.ringo, W.banana, W.pan), speak(W.ringo), speak(W.banana), speak(W.keeki)],
    junior: [speak(W.gohan), speak(W.tamago), heard(W.tamago, W.gohan, W.sakana), speak(W.sakana), speak(W.raamen), speak(W.juusu)],
    teen: [speak(W.gyouza), speak(W.tenpura), heard(W.tenpura, W.gyouza, W.raamen), speak(W.aisukuriimu), speak(W.chokoreeto), speak(W.koohii)],
  }),
  lesson('ja-food-2', 'Useful phrases', '💬', 'phrases', {
    little: [speak(P.konnichiwa), speak(P.arigatou), heard(P.arigatou, P.oishii), speak(P.oishii), speak(P.kudasai)],
    junior: [speak(P.mizuWo), speak(P.juusuWo), heard(P.mizuWo, P.juusuWo, P.onakaGaSuita), speak(P.onakaGaSuita), speak(P.itadakimasu)],
    teen: [speak(P.raamenWo), speak(P.ikuraDesuka), heard(P.ikuraDesuka, P.koreWo, P.okaikei), speak(P.okaikei), speak(P.gochisousamaDeshita)],
  }),
  lesson('ja-food-3', 'Long and short beats', '🥁', 'pronunciation', {
    little: [pair(W.obasan, W.obaasan, 1, 'ja:long'), speak(W.obaasan), speak(W.keeki), pair(W.kite, W.kitte, 1, 'ja:Q'), speak(W.kitte)],
    junior: [pair(W.ojisan, W.ojiisan, 1, 'ja:long'), speak(W.ojiisan), pair(W.kite, W.kitte, 1, 'ja:Q'), speak(W.gakkou), speak(W.raamen)],
    teen: [pair(W.kite, W.kitte, 1, 'ja:Q'), speak(W.gakkou), pair(W.yuki, W.yuuki, 1, 'ja:long'), speak(W.kyuuri), speak(W.densha)],
  }),
  lesson('ja-food-4', 'Listen closely', '👂', 'listening', {
    little: [heard(W.mizu, W.pan, W.ringo), pair(W.ojisan, W.ojiisan, 0, 'ja:long'), heard(W.keeki, W.banana, W.mikan), speak(W.mikan)],
    junior: [pair(W.yuki, W.yuuki, 1, 'ja:long'), heard(W.onigiri, W.gohan, W.sakana), pair(W.obasan, W.obaasan, 0, 'ja:long'), heard(W.juusu, W.suupu, W.koohii), speak(W.onigiri)],
    teen: [pair(W.ojisan, W.ojiisan, 0, 'ja:long'), heard(P.koreWo, P.ikuraDesuka, P.okaikei), pair(W.obasan, W.obaasan, 1, 'ja:long'), heard(W.koohii, W.keeki, W.suupu), speak(P.totemoOishii)],
  }),
  lesson('ja-food-5', 'Say what you see', '🗣️', 'speaking', {
    little: [speak(W.ringo, 'image'), speak(W.banana, 'image'), speak(W.pan, 'image'), speak(W.mikan, 'image')],
    junior: [speak(W.raamen, 'image'), speak(W.onigiri, 'image'), speak(W.tamago, 'image'), speak(W.sakana, 'image')],
    teen: [speak(W.gyouza, 'image'), speak(W.tenpura, 'image'), speak(W.aisukuriimu, 'image'), speak(W.kyuuri, 'image')],
  }),
  lesson('ja-food-6', 'At the restaurant', '🍱', 'conversation', {
    little: [dialogue(T.nanigaii, '🧑‍🍳', P.ringoKudasai, P.mizuKudasai), dialogue(T.douzo, '🍽️', P.arigatou), dialogue(T.oishii, '😋', P.oishii)],
    junior: [dialogue(T.naniWoNomimasuka, '🧑‍🍳', P.mizuWo, P.juusuWo), dialogue(T.naniWoTabemasuka, '🧑‍🍳', P.sushiWo, P.onigiriWo), dialogue(T.oishiiDesuka, '😋', P.oishiiDesu)],
    teen: [dialogue(T.nanmeisama, '🧑‍🍳', P.hitoriDesu, P.futariDesu), dialogue(T.naniWoTabemasuka, '🧑‍🍳', P.raamenWo, P.gyouzaWo), dialogue(T.oishiiDesuka, '😋', P.totemoOishii, P.gochisousamaDeshita)],
  }),
  lesson('ja-food-7', 'Review', '🏆', 'review', {
    little: [speak(W.ringo, 'image'), speak(P.arigatou), speak(W.keeki), speak(P.oishii)],
    junior: [speak(P.mizuWo), speak(W.ojiisan), speak(W.raamen), speak(P.itadakimasu)],
    teen: [speak(P.raamenWo), speak(W.gakkou), speak(P.okaikei), speak(W.aisukuriimu)],
  }),
];

const lockedUnit = (id: string, title: string, subtitle: string, icon: string, color: string, grownUp?: Unit['grownUp']): Unit => ({ id, title, subtitle, icon, color, lessons: [], locked: true, grownUp });

export const JA_COURSE: Course = {
  id: 'japanese-adventure',
  title: 'Japanese Adventure',
  grownUpTitle: 'Japanese',
  language: 'ja',
  units: [
    { id: 'ja-food', title: 'Yummy Food おいしい', subtitle: 'Order food and drinks in Japanese', icon: '🍙', color: 'var(--coral)', lessons: foodLessons, grownUp: { title: 'Food & Drink', subtitle: 'Order, eat and pay in Japanese' } },
    lockedUnit('ja-family', 'My Family かぞく', 'Mum, dad, grandma and me', '👨‍👩‍👧', 'var(--sky)', { title: 'Family', subtitle: 'Talk about the people in your life' }),
    lockedUnit('ja-out', 'Out and About でかけよう', 'Trains, shops and asking the way', '🚃', 'var(--leaf)', { title: 'Getting Around', subtitle: 'Trains, tickets and directions' }),
    lockedUnit('ja-school', 'At School がっこう', 'Classroom words and questions', '🎒', 'var(--sun)', { title: 'School & Study', subtitle: 'Classroom words and questions' }),
  ],
};

/** Short speaking check the first time someone opens the Japanese course. */
export const JA_CHECK_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = {
  little: [W.mizu, W.ringo, P.arigatou],
  junior: [W.raamen, P.mizuWo, W.ojiisan],
  teen: [W.gakkou, P.raamenWo, W.kyuuri],
};

// ---------- Pronunciation Lab: sound → syllables → words → phrases → sentence ----------
type Ladder = Record<LabStage, SpeakItem[]>;
const L = (syllables: SpeakItem[], words: SpeakItem[], phrases: SpeakItem[], sentence: SpeakItem): Ladder => ({ syllables, words, phrases, sentence: [sentence] });

export const JA_LADDERS: Record<PhonemeId, Ladder> = {
  'ja:long': L([W.ii, W.zou, W.koori], [W.obaasan, W.ojiisan, W.koohii], [P.oishii, P.iie], P.totemoOishii),
  'ja:Q': L([W.chotto, W.motto, W.kippu], [W.kitte, W.gakkou, W.zasshi], [P.chottoMatte, P.mottoKudasai], P.densha_de),
  'ja:N': L([W.pan, W.hon, W.en], [W.mikan, W.raamen, W.densha], [P.konnichiwa, P.gohanWo], P.raamenWo),
  'ja:r': L([W.risu, W.tori, W.hare], [W.ringo, W.kuruma, W.sakura], [P.arigatou, P.koreWo], P.sakuraGaKirei),
  'ja:ts': L([W.tsuki, W.natsu, W.kutsu], [W.tsukue, W.itsutsu, W.mittsu], [P.hitotsuKudasai, P.futatsuKudasai], P.natsuWaAtsui),
  'ja:f': L([W.fune, W.fuku, W.fuyu], [W.toufu, W.fuusen, W.saifu], [P.futatsuKudasai, P.futariDesu], P.fuusenGaFutatsu),
  'ja:z': L([W.mizu, W.zou, W.kaze], [W.juusu, W.gyouza, W.jitensha], [P.mizuWo, P.juusuWo], P.mizuToJuusu),
  'ja:voiced': L([W.doa, W.basu, W.gomu], [W.gakkou, W.tamago, W.banana], [P.itadakimasu, P.gohanWo], P.gochisousamaDeshita),
  'ja:y': L([W.kyuu, W.nyaa, W.hyaku], [W.kyuuri, W.kyou, W.gyuunyuu], [P.kyuuriWo, P.gyouzaWo], P.kyouWaHare),
};

export const JA_LAB_SOUNDS: PhonemeId[] = ['ja:long', 'ja:Q', 'ja:r', 'ja:N', 'ja:voiced', 'ja:z', 'ja:ts', 'ja:f', 'ja:y'];

/** Every Japanese item, for indexing and for the accuracy test set. */
export const JA_ITEMS: SpeakItem[] = [...new Map([...Object.values(JW), ...Object.values(JP), ...Object.values(T)].map((it) => [it.id, it])).values()];
