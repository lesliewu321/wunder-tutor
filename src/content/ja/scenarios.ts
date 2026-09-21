import type { Scenario } from '../scenarios';
import { ja } from './course';

// Conversations in Japanese, for the Japanese course: the same three scenes as the other courses (Leslie: "conversation
// need to follow language selected — eng, chinese, french and japanese").
//
// Register follows who is talking, as it would in Japan: shop staff are polite (です・ます), and polite to a child too
// in the older bands; children talk to each other casually (あそぼう！). A learner's line never needs a gendered word —
// no わたし/ぼく, which a boy and a girl would choose differently — and the friend has a pretend name (ゆい) and asks
// only about colours and games. Every line is written with its readings (kana.ts), so the voice, the scorer, the
// furigana and the romaji all come from the same place.

const T = {
  // The ramen shop
  suita: ja('いらっしゃい！ おなか、すいた？', 'Welcome! Are you hungry?'),
  nomu: ja('なに、のむ？', 'What would you like to drink?'),
  taberu: ja('なに、たべる？', 'What would you like to eat?'),
  douzo: ja('はい、どうぞ！', 'Here you are!'),
  suiteImasuka: ja('いらっしゃいませ！ おなか が すいて います か？', 'Welcome! Are you hungry?'),
  nomimasuka: ja('{何|なに} を {飲|の}みます か？', 'What would you like to drink?'),
  tabemasuka: ja('{何|なに} を {食|た}べます か？', 'What would you like to eat?'),
  douzoPolite: ja('はい、どうぞ。', 'Here you are.'),
  nanmeisama: ja('いらっしゃいませ！ {何名|なんめい}さま です か？', 'Welcome! How many of you?'),
  onomimono: ja('こちら {へ|え} どうぞ。 お{飲|の}み{物|もの} {は|わ}？', 'This way, please. Anything to drink?'),
  gochuumon: ja('ご{注文|ちゅうもん} {は|わ} {何|なに} に します か？', 'What would you like to order?'),
  omatase: ja('お{待|ま}たせ しました。 どうぞ。', 'Sorry to keep you waiting. Here you are.'),

  // The zoo
  doubutsuSuki: ja('こんにち{は|わ}！ どうぶつ、すき？', 'Hi! Do you like animals?'),
  koreNaani: ja('みて！ これ、なあに？', 'Look! What’s this?'),
  kawaiine: ja('かわいい ね！', 'Cute, isn’t it!'),
  kaerou: ja('そろそろ かえろう。 ばいばい！', 'Time to go home. Bye-bye!'),
  youkoso: ja('どうぶつえん {へ|え} ようこそ！ どうぶつ が {好|す}き です か？', 'Welcome to the zoo! Do you like animals?'),
  asokoMite: ja('あそこ を {見|み}て ください。 {何|なに} が います か？', 'Look over there. What can you see?'),
  ichiban: ja('いちばん {好|す}き な どうぶつ {は|わ} {何|なん} です か？', 'Which animal do you like best?'),
  tanoshikatta: ja('もう すぐ しまります。 たのしかった です か？', 'We close soon. Did you have fun?'),
  hajimete: ja('ようこそ！ この どうぶつえん {は|わ} はじめて です か？', 'Welcome! Is this your first time at this zoo?'),
  dono: ja('どの どうぶつ から {見|み}たい です か？', 'Which animals would you like to see first?'),
  omoshiroi: ja('どの どうぶつ が いちばん おもしろい と {思|おも}います か？', 'Which animal do you think is the most interesting?'),
  heien: ja('そろそろ へいえん です。 たのしめました か？', 'It’s nearly closing time. Did you enjoy it?'),

  // A new friend
  yui: ja('こんにち{は|わ}！ ゆい だよ！', 'Hi! I’m Yui!'),
  akaSuki: ja('あか が すき！ きみ {は|わ}？', 'I like red! What about you?'),
  asobou: ja('いっしょ に あそぼう！', 'Let’s play together!'),
  yoroshiku: ja('こんにち{は|わ}！ ゆい です。 よろしく ね！', 'Hi! I’m Yui. Nice to meet you!'),
  naniiro: ja('あか が いちばん すき。 なにいろ が すき？', 'Red is my favourite. Which colour do you like?'),
  asobanai: ja('いい ね！ いっしょ に あそばない？', 'Nice! Do you want to play together?'),
  hajimeteAu: ja('やあ！ ゆい です。 はじめて {会|あ}う よね？', 'Hi! I’m Yui. We haven’t met before, have we?'),
  sakkaa: ja('サッカー が {好|す}き なんだ。 {何|なに} を する の が {好|す}き？', 'I love football. What do you like doing?'),
  issho: ja('いい ね！ あっち で サッカー してる けど、 いっしょ に どう？', 'Nice! We’re playing football over there. Want to join?'),
};

/** What the learner can say back. */
const R = {
  // The ramen shop
  unSuita: ja('うん、すいた！', 'Yes, I’m hungry!', '😋'),
  konnichiwa: ja('こんにち{は|わ}！', 'Hello!', '👋'),
  mizuKudasai: ja('みず、ください', 'Water, please', '💧'),
  juusuKudasai: ja('ジュース、ください', 'Juice, please', '🧃'),
  raamenKudasai: ja('ラーメン、ください', 'Ramen, please', '🍜'),
  onigiriKudasai: ja('おにぎり、ください', 'A rice ball, please', '🍙'),
  arigatou: ja('ありがとう！', 'Thank you!', '🙏'),
  haiSuite: ja('はい、すいて います。', 'Yes, I’m hungry.', '😋'),
  sukoshi: ja('すこし すいて います。', 'I’m a little hungry.', '🤏'),
  mizuWo: ja('{水|みず} を ください。', 'Water, please.', '💧'),
  ochaWo: ja('お{茶|ちゃ} を ください。', 'Green tea, please.', '🍵'),
  raamenWo: ja('ラーメン を ください。', 'Ramen, please.', '🍜'),
  gyouzaWo: ja('ぎょうざ を ください。', 'Dumplings, please.', '🥟'),
  arigatouGozaimasu: ja('ありがとう ございます！', 'Thank you very much!', '🙏'),
  hitori: ja('ひとり です。', 'Just one.', '☝️'),
  futari: ja('ふたり です。', 'Two of us.', '✌️'),
  ochaOnegai: ja('お{茶|ちゃ} を お{願|ねが}い します。', 'Green tea, please.', '🍵'),
  omizuDe: ja('お{水|みず} で だいじょうぶ です。', 'Water is fine.', '💧'),
  raamenOnegai: ja('ラーメン を お{願|ねが}い します。', 'Ramen, please.', '🍜'),
  osusume: ja('おすすめ {は|わ} {何|なん} です か？', 'What do you recommend?', '🤔'),
  itadakimasu: ja('いただきます！', 'Let’s eat!', '🙏'),
  oishisou: ja('とても おいしそう です！', 'It looks delicious!', '🤤'),

  // The zoo
  unSuki: ja('うん、すき！', 'Yes, I do!', '😊'),
  daisuki: ja('だいすき！', 'I love them!', '💛'),
  panda: ja('パンダ！', 'A panda!', '🐼'),
  zou: ja('ぞう！', 'An elephant!', '🐘'),
  unKawaii: ja('うん、かわいい！', 'Yes, so cute!', '🥰'),
  ookii: ja('おおきい！', 'It’s big!', '🐘'),
  baibai: ja('ばいばい！', 'Bye-bye!', '👋'),
  haiDaisuki: ja('はい、だいすき です。', 'Yes, I love them.', '💛'),
  pandaGaSuki: ja('パンダ が {好|す}き です。', 'I like pandas.', '🐼'),
  raionGaImasu: ja('ライオン が います。', 'There’s a lion.', '🦁'),
  saruGaImasu: ja('さる が います。', 'There’s a monkey.', '🐒'),
  pandaDesu: ja('パンダ です。', 'Pandas.', '🐼'),
  zouGaIchiban: ja('ぞう が いちばん {好|す}き です。', 'I like elephants best.', '🐘'),
  haiTanoshikatta: ja('はい、たのしかった です！', 'Yes, it was fun!', '😄'),
  totemoTanoshikatta: ja('とても たのしかった です。', 'It was great fun.', '😄'),
  haiHajimete: ja('はい、はじめて です。', 'Yes, it’s my first time.', '🆕'),
  yokuKimasu: ja('いいえ、よく {来|き}ます。', 'No, I come often.', '🔁'),
  pandaGaMitai: ja('パンダ が {見|み}たい です。', 'I’d like to see the pandas.', '🐼'),
  raionWoMitai: ja('ライオン を {見|み}たい です。', 'I’d like to see the lions.', '🦁'),
  pandaKawaii: ja('パンダ が いちばん かわいい と {思|おも}います。', 'I think pandas are the cutest.', '🐼'),
  zouOmoshiroi: ja('ぞう が いちばん おもしろい です。', 'Elephants are the most interesting.', '🐘'),
  totemoTanoshikattaHai: ja('はい、とても たのしかった です。', 'Yes, it was great fun.', '😄'),
  mataKitai: ja('また {来|き}たい です！', 'I’d like to come again!', '🔁'),

  // A new friend
  yuiChan: ja('こんにち{は|わ}、ゆいちゃん！', 'Hi, Yui!', '👋'),
  onaji: ja('おなじ！', 'Same!', '🙌'),
  aoGaSuki: ja('あお が すき！', 'I like blue!', '🔵'),
  unAsobou: ja('うん、あそぼう！', 'Yes, let’s play!', '🤸'),
  iiyo: ja('いい よ！', 'OK!', '👍'),
  yoroshikune: ja('よろしく ね！', 'Nice to meet you!', '🤝'),
  aoIchiban: ja('あお が いちばん すき。', 'Blue is my favourite.', '🔵'),
  akaMoSuki: ja('あか も すき！', 'I like red too!', '🔴'),
  iiyoAsobou: ja('いい よ、あそぼう！', 'Sure, let’s play!', '🤸'),
  hajimemashite: ja('はじめまして。 よろしく。', 'Nice to meet you.', '🤝'),
  hajimeteDane: ja('うん、はじめて だ ね。', 'Yes, it’s the first time.', '🆕'),
  sakkaaSuki: ja('サッカー、{好|す}き だ よ！', 'I like football!', '⚽'),
  honWoYomu: ja('{本|ほん} を {読|よ}む の が {好|す}き。', 'I like reading books.', '📚'),
  zehi: ja('うん、ぜひ！', 'Yes, I’d love to!', '😊'),
  iineArigatou: ja('いい ね、ありがとう！', 'Great, thanks!', '😊'),
};

const BYE = {
  matane: ja('また ね！', 'See you!'),
  mataKiteKudasai: ja('ありがとう ございました！ また {来|き}て ください ね。', 'Thank you! Please come again.'),
  mataDouzo: ja('ありがとう ございました。 また どうぞ！', 'Thank you. Please come again!'),
  mataKitene: ja('また きて ね！', 'Come again!'),
  sayounara: ja('きて くれて ありがとう。 さようなら！', 'Thanks for coming. Goodbye!'),
  goraien: ja('ご{来園|らいえん} ありがとう ございました！', 'Thank you for visiting!'),
  tanoshikattaMatane: ja('たのしかった！ また ね！', 'That was fun! See you!'),
  ashitane: ja('きょう {は|わ} たのしかった！ また あした ね！', 'Today was fun! See you tomorrow!'),
  jaaMatane: ja('じゃあ、また ね！', 'See you later!'),
};

export const JA_SCENARIOS: Scenario[] = [
  {
    id: 'ja-cafe', course: 'ja', title: 'The Ramen Shop', icon: '🍜', color: 'var(--coral)',
    blurb: { little: 'Ask for ramen in Japanese!', junior: 'Order a drink and some food in Japanese.', teen: 'Get a table, order and eat in Japanese.' },
    setting: 'A small ramen shop in Japan. The learner is a customer ordering food and drink, in Japanese.',
    tutorRole: 'a friendly member of staff at a ramen shop',
    goals: ['greet', 'order a drink', 'order food', 'say thank you'],
    turns: [
      {
        tutor: { little: T.suita, junior: T.suiteImasuka, teen: T.nanmeisama },
        replies: { little: [R.unSuita, R.konnichiwa], junior: [R.haiSuite, R.sukoshi], teen: [R.hitori, R.futari] },
      },
      {
        tutor: { little: T.nomu, junior: T.nomimasuka, teen: T.onomimono },
        replies: { little: [R.mizuKudasai, R.juusuKudasai], junior: [R.mizuWo, R.ochaWo], teen: [R.ochaOnegai, R.omizuDe] },
      },
      {
        tutor: { little: T.taberu, junior: T.tabemasuka, teen: T.gochuumon },
        replies: { little: [R.raamenKudasai, R.onigiriKudasai], junior: [R.raamenWo, R.gyouzaWo], teen: [R.raamenOnegai, R.osusume] },
      },
      {
        tutor: { little: T.douzo, junior: T.douzoPolite, teen: T.omatase },
        replies: { little: [R.arigatou], junior: [R.arigatouGozaimasu], teen: [R.itadakimasu, R.oishisou] },
      },
    ],
    closing: { little: BYE.matane, junior: BYE.mataKiteKudasai, teen: BYE.mataDouzo },
  },
  {
    id: 'ja-zoo', course: 'ja', title: 'The Zoo in Tokyo', icon: '🐼', color: 'var(--leaf)',
    blurb: { little: 'Say hello to the pandas in Japanese!', junior: 'Talk about the animals you see, in Japanese.', teen: 'Plan your visit with a guide, in Japanese.' },
    setting: 'A big zoo in Tokyo. The learner is a visitor talking to a guide about the animals, in Japanese.',
    tutorRole: 'a friendly zoo guide',
    goals: ['greet', 'name animals', 'say what you like', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.doubutsuSuki, junior: T.youkoso, teen: T.hajimete },
        replies: { little: [R.unSuki, R.daisuki], junior: [R.haiDaisuki, R.pandaGaSuki], teen: [R.haiHajimete, R.yokuKimasu] },
      },
      {
        tutor: { little: T.koreNaani, junior: T.asokoMite, teen: T.dono },
        replies: { little: [R.panda, R.zou], junior: [R.raionGaImasu, R.saruGaImasu], teen: [R.pandaGaMitai, R.raionWoMitai] },
      },
      {
        tutor: { little: T.kawaiine, junior: T.ichiban, teen: T.omoshiroi },
        replies: { little: [R.unKawaii, R.ookii], junior: [R.pandaDesu, R.zouGaIchiban], teen: [R.pandaKawaii, R.zouOmoshiroi] },
      },
      {
        tutor: { little: T.kaerou, junior: T.tanoshikatta, teen: T.heien },
        replies: { little: [R.baibai, R.arigatou], junior: [R.haiTanoshikatta, R.totemoTanoshikatta], teen: [R.totemoTanoshikattaHai, R.mataKitai] },
      },
    ],
    closing: { little: BYE.mataKitene, junior: BYE.sayounara, teen: BYE.goraien },
  },
  {
    id: 'ja-friend', course: 'ja', title: 'A New Friend', icon: '🎈', color: 'var(--sky)',
    blurb: { little: 'Say hi and play, in Japanese!', junior: 'Meet a new friend at the park, in Japanese.', teen: 'Make small talk with someone new, in Japanese.' },
    setting: 'A park. The learner meets a friendly child called Yui (ゆい) and talks about favourite things, in Japanese (never real personal details).',
    tutorRole: 'Yui, a friendly kid at the park',
    goals: ['greet', 'talk about favourite things', 'suggest playing', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.yui, junior: T.yoroshiku, teen: T.hajimeteAu },
        replies: { little: [R.yuiChan, R.konnichiwa], junior: [R.yoroshikune, R.yuiChan], teen: [R.hajimemashite, R.hajimeteDane] },
      },
      {
        tutor: { little: T.akaSuki, junior: T.naniiro, teen: T.sakkaa },
        replies: { little: [R.onaji, R.aoGaSuki], junior: [R.aoIchiban, R.akaMoSuki], teen: [R.sakkaaSuki, R.honWoYomu] },
      },
      {
        tutor: { little: T.asobou, junior: T.asobanai, teen: T.issho },
        replies: { little: [R.unAsobou, R.iiyo], junior: [R.iiyoAsobou, R.unAsobou], teen: [R.zehi, R.iineArigatou] },
      },
    ],
    closing: { little: BYE.tanoshikattaMatane, junior: BYE.ashitane, teen: BYE.jaaMatane },
  },
];
