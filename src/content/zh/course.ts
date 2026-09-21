import type { Course, Exercise, Lesson, PhonemeId, SpeakItem, Unit } from '../../domain/types';
import type { LabStage } from '../lab';

// Mandarin (Putonghua) course for Hong Kong children who already meet Putonghua at school.
// Every item carries Simplified characters (what the scorer is sent), Traditional characters (what a Hong Kong
// child reads) and numbered pinyin with CITATION tones, one syllable per character. Tone changes in running speech
// (你好 → ní hǎo, 一杯 → yì bēi, 不客气 → bú kè qi) are computed by surfaceTones(), never typed by hand.

const kindOf = (hans: string, syllables: number): SpeakItem['kind'] =>
  syllables === 1 ? 'word' : /[。！？]$/.test(hans) && syllables > 3 ? 'sentence' : syllables <= 3 && !/[。！？，]/.test(hans) ? 'word' : 'phrase';

/** A Mandarin speaking item. `py` is numbered pinyin for the characters only (punctuation has none). */
export const zi = (hans: string, hant: string, py: string, meaning?: string, picture?: string, focus?: PhonemeId[]): SpeakItem => {
  const syllables = py.trim().split(/\s+/);
  const chars = [...hans].filter((c) => /\p{Script=Han}/u.test(c));
  if (chars.length !== syllables.length) throw new Error(`pinyin/character count mismatch in ${hans}: ${chars.length} vs ${syllables.length}`);
  return {
    id: `zh-${syllables.join('-')}${/[。！？]$/.test(hans) ? '-s' : ''}`,
    text: hans, lang: 'zh-CN', zh: { hant, py }, picture, meaning, focus, kind: kindOf(hans, syllables.length),
  };
};

let n = 0;
const speak = (it: SpeakItem, prompt: 'text' | 'image' = 'text'): Exercise => ({ id: `zx-${++n}`, type: 'speak', item: it, prompt });
const heard = (answer: SpeakItem, ...others: SpeakItem[]): Exercise => ({ id: `zx-${++n}`, type: 'choose-heard', answer, options: [answer, ...others] });
const pair = (a: SpeakItem, b: SpeakItem, answerIndex: 0 | 1, focus: PhonemeId): Exercise => ({ id: `zx-${++n}`, type: 'minimal-pair', pair: [a, b], answerIndex, focus });
const dialogue = (tutor: SpeakItem, picture: string, ...replies: SpeakItem[]): Exercise => ({ id: `zx-${++n}`, type: 'dialogue', tutorLine: tutor.text, tutor, replies, picture });

// ---------- Words ----------
export const ZW = {
  shui: zi('水', '水', 'shui3', 'water', '💧', ['zh:sh', 'zh:t3']),
  niunai: zi('牛奶', '牛奶', 'niu2 nai3', 'milk', '🥛', ['zh:n', 'zh:t2']),
  pingguo: zi('苹果', '蘋果', 'ping2 guo3', 'apple', '🍎', ['zh:-ng', 'zh:t2']),
  xiangjiao: zi('香蕉', '香蕉', 'xiang1 jiao1', 'banana', '🍌', ['zh:j', 'zh:t1']),
  mianbao: zi('面包', '麵包', 'mian4 bao1', 'bread', '🍞', ['zh:t4']),
  jidan: zi('鸡蛋', '雞蛋', 'ji1 dan4', 'egg', '🥚', ['zh:j', 'zh:t1']),
  mifan: zi('米饭', '米飯', 'mi3 fan4', 'rice', '🍚', ['zh:t3', 'zh:t4']),
  miantiao: zi('面条', '麵條', 'mian4 tiao2', 'noodles', '🍜', ['zh:t4', 'zh:t2']),
  guozhi: zi('果汁', '果汁', 'guo3 zhi1', 'juice', '🧃', ['zh:sh']),
  dangao: zi('蛋糕', '蛋糕', 'dan4 gao1', 'cake', '🍰', ['zh:t4']),
  cha: zi('茶', '茶', 'cha2', 'tea', '🍵', ['zh:sh', 'zh:t2']),
  yu: zi('鱼', '魚', 'yu2', 'fish', '🐟', ['zh:ü', 'zh:t2']),
  tang: zi('汤', '湯', 'tang1', 'soup', '🍲', ['zh:-ng', 'zh:t1']),
  tangSweet: zi('糖', '糖', 'tang2', 'sweets', '🍬', ['zh:t2']),
  xigua: zi('西瓜', '西瓜', 'xi1 gua1', 'watermelon', '🍉', ['zh:j', 'zh:t1']),
  qiaokeli: zi('巧克力', '巧克力', 'qiao3 ke4 li4', 'chocolate', '🍫', ['zh:j']),
  jiaozi: zi('饺子', '餃子', 'jiao3 zi5', 'dumplings', '🥟', ['zh:j']),
  bingqilin: zi('冰淇淋', '冰淇淋', 'bing1 qi2 lin2', 'ice cream', '🍦', ['zh:-ng', 'zh:n']),
  ma1: zi('妈', '媽', 'ma1', 'mum', '👩', ['zh:t1']),
  ma2: zi('麻', '麻', 'ma2', 'numbing (as in spicy)', '🌶️', ['zh:t2']),
  ma3: zi('马', '馬', 'ma3', 'horse', '🐴', ['zh:t3']),
  mai3: zi('买', '買', 'mai3', 'to buy', '🛒', ['zh:t3']),
  mai4: zi('卖', '賣', 'mai4', 'to sell', '🏷️', ['zh:t4']),
  shi1: zi('诗', '詩', 'shi1', 'a poem', '📜', ['zh:sh']),
  si1: zi('丝', '絲', 'si1', 'silk thread', '🧵', ['zh:s']),
  shi4: zi('是', '是', 'shi4', 'yes / is', '✅', ['zh:sh', 'zh:t4']),
  si4: zi('四', '四', 'si4', 'four', '4️⃣', ['zh:s', 'zh:t4']),
  shi2: zi('十', '十', 'shi2', 'ten', '🔟', ['zh:sh', 'zh:t2']),
  ni3: zi('你', '你', 'ni3', 'you', '🫵', ['zh:n']),
  li3: zi('李', '李', 'li3', 'plum (and a family name)', '🍑', ['zh:n']),
  ba1: zi('八', '八', 'ba1', 'eight', '8️⃣', ['zh:t1']),
  chi1: zi('吃', '吃', 'chi1', 'to eat', '😋', ['zh:sh', 'zh:t1']),
  xuexi: zi('学习', '學習', 'xue2 xi2', 'to study', '📚', ['zh:t2', 'zh:ü']),
  xiongmao: zi('熊猫', '熊貓', 'xiong2 mao1', 'panda', '🐼', ['zh:t2']),
  piqiu: zi('皮球', '皮球', 'pi2 qiu2', 'ball', '⚽', ['zh:t2']),
  mi3: zi('米', '米', 'mi3', 'rice grains', '🌾', ['zh:t3']),
  gou3: zi('狗', '狗', 'gou3', 'dog', '🐶', ['zh:t3']),
  xiaogou: zi('小狗', '小狗', 'xiao3 gou3', 'puppy', '🐕', ['zh:t3']),
  laohu: zi('老虎', '老虎', 'lao3 hu3', 'tiger', '🐯', ['zh:t3']),
  da4: zi('大', '大', 'da4', 'big', '🐘', ['zh:t4']),
  ba4: zi('爸', '爸', 'ba4', 'dad', '👨', ['zh:t4']),
  zaijian: zi('再见', '再見', 'zai4 jian4', 'goodbye', '👋', ['zh:t4']),
  dianshi: zi('电视', '電視', 'dian4 shi4', 'television', '📺', ['zh:t4', 'zh:sh']),
  zhi1: zi('知', '知', 'zhi1', 'to know', '💡', ['zh:sh']),
  shu1: zi('书', '書', 'shu1', 'book', '📖', ['zh:sh']),
  shizi: zi('狮子', '獅子', 'shi1 zi5', 'lion', '🦁', ['zh:sh']),
  nv3: zi('女', '女', 'nv3', 'girl / female', '👧', ['zh:ü', 'zh:n']),
  lv4: zi('绿', '綠', 'lv4', 'green', '🟢', ['zh:ü']),
  // 雨 on its own is read yù by the scorer (it can be a verb); taught inside 下雨 instead.
  juzi: zi('橘子', '橘子', 'ju2 zi5', 'tangerine', '🍊', ['zh:ü', 'zh:j']),
  qu4: zi('去', '去', 'qu4', 'to go', '🚶', ['zh:ü', 'zh:j']),
  xue2: zi('学', '學', 'xue2', 'to learn', '✏️', ['zh:ü']),
  niu2: zi('牛', '牛', 'niu2', 'cow', '🐮', ['zh:n']),
  nainai: zi('奶奶', '奶奶', 'nai3 nai5', 'grandma', '👵', ['zh:n']),
  lanse: zi('蓝色', '藍色', 'lan2 se4', 'blue', '🔵', ['zh:n']),
  bing1: zi('冰', '冰', 'bing1', 'ice', '🧊', ['zh:-ng']),
  ji1: zi('鸡', '雞', 'ji1', 'chicken', '🐔', ['zh:j']),
  qi1: zi('七', '七', 'qi1', 'seven', '7️⃣', ['zh:j']),
  xi1: zi('西', '西', 'xi1', 'west', '🧭', ['zh:j']),
  kafei: zi('咖啡', '咖啡', 'ka1 fei1', 'coffee', '☕', ['zh:t1']),
};

// ---------- Phrases and sentences ----------
export const ZP = {
  woYaoShui: zi('我要水。', '我要水。', 'wo3 yao4 shui3', 'I want water.', '💧', ['zh:sh', 'zh:t3']),
  xiexie: zi('谢谢！', '謝謝！', 'xie4 xie5', 'Thank you!', '💛', ['zh:t4']),
  zaijian: zi('再见！', '再見！', 'zai4 jian4', 'Goodbye!', '👋', ['zh:t4']),
  haochi: zi('好吃！', '好吃！', 'hao3 chi1', 'Yummy!', '😋', ['zh:sh', 'zh:t3']),
  xiangHeShui: zi('我想喝水。', '我想喝水。', 'wo3 xiang3 he1 shui3', 'I’d like to drink water.', '💧', ['zh:t3', 'zh:sh']),
  yaoPingguo: zi('我要苹果。', '我要蘋果。', 'wo3 yao4 ping2 guo3', 'I want an apple.', '🍎', ['zh:t2', 'zh:t3']),
  eLe: zi('我饿了。', '我餓了。', 'wo3 e4 le5', 'I’m hungry.', '😋', ['zh:t4']),
  bukeqi: zi('不客气。', '不客氣。', 'bu4 ke4 qi5', 'You’re welcome.', '🙂', ['zh:t2', 'zh:t4']),
  qingGei: zi('请给我一杯水。', '請給我一杯水。', 'qing3 gei3 wo3 yi1 bei1 shui3', 'Please give me a glass of water.', '🥛', ['zh:t3', 'zh:t4']),
  xiangChiShenme: zi('你想吃什么？', '你想吃什麼？', 'ni3 xiang3 chi1 shen2 me5', 'What would you like to eat?', '🍽️', ['zh:sh', 'zh:t3']),
  xihuanYu: zi('我喜欢吃鱼。', '我喜歡吃魚。', 'wo3 xi3 huan5 chi1 yu2', 'I like eating fish.', '🐟', ['zh:ü', 'zh:sh']),
  henHaochi: zi('很好吃！', '很好吃！', 'hen3 hao3 chi1', 'Very tasty!', '😋', ['zh:t3', 'zh:sh']),
  yaoTang: zi('我要糖。', '我要糖。', 'wo3 yao4 tang2', 'I want sweets.', '🍬', ['zh:t2']),
  /**
   * NOT USED IN ANY LESSON, on purpose. The classic tongue twister, and the scorer cannot cope with it: said alone
   * 四 scores 95 and 是 scores 90, but in this sequence 四 drops to 56 and the line to 81. All six Gemini voices
   * score between 28 and 82 on it, so no teacher recording can be made — and if a perfect rendering is marked down
   * like that, a learner saying it correctly would be told they were wrong, which is worse than not offering it.
   * Kept here because the accuracy test set has takes of it, and it is the sharpest example we have of the scorer
   * failing on a sequence rather than on a sound. Measure before bringing it back: `node eval/teacher-gate.mjs`.
   */
  sishisi: zi('四是四，十是十。', '四是四，十是十。', 'si4 shi4 si4 shi2 shi4 shi2', 'Four is four, ten is ten.', '🔢', ['zh:sh', 'zh:t4', 'zh:t2']),
  nihao: zi('你好！', '你好！', 'ni3 hao3', 'Hello!', '👋', ['zh:t3', 'zh:n']),
  heGuozhi: zi('我想喝果汁。', '我想喝果汁。', 'wo3 xiang3 he1 guo3 zhi1', 'I’d like some juice.', '🧃', ['zh:sh', 'zh:t3']),
  buE: zi('我不饿。', '我不餓。', 'wo3 bu4 e4', 'I’m not hungry.', '🙅', ['zh:t2', 'zh:t4']),
  heCha: zi('我想喝茶。', '我想喝茶。', 'wo3 xiang3 he1 cha2', 'I’d like some tea.', '🍵', ['zh:sh', 'zh:t2']),
  chiMiantiao: zi('我想吃面条。', '我想吃麵條。', 'wo3 xiang3 chi1 mian4 tiao2', 'I’d like to eat noodles.', '🍜', ['zh:sh', 'zh:t4']),
  haochiXiexie: zi('很好吃，谢谢！', '很好吃，謝謝！', 'hen3 hao3 chi1 xie4 xie5', 'Very tasty, thank you!', '😋', ['zh:t3', 'zh:sh']),
  heTang: zi('喝汤', '喝湯', 'he1 tang1', 'drink soup', '🍲', ['zh:t1', 'zh:-ng']),
  chiXiangjiao: zi('吃香蕉', '吃香蕉', 'chi1 xiang1 jiao1', 'eat a banana', '🍌', ['zh:t1']),
  mamaHeTang: zi('妈妈喝汤。', '媽媽喝湯。', 'ma1 ma5 he1 tang1', 'Mum drinks soup.', '👩', ['zh:t1']),
  heCha2: zi('喝茶', '喝茶', 'he1 cha2', 'drink tea', '🍵', ['zh:t2', 'zh:sh']),
  chiYu: zi('吃鱼', '吃魚', 'chi1 yu2', 'eat fish', '🐟', ['zh:t2', 'zh:ü']),
  xiongmaoHeCha: zi('熊猫喝茶。', '熊貓喝茶。', 'xiong2 mao1 he1 cha2', 'The panda drinks tea.', '🐼', ['zh:t2']),
  heShui: zi('喝水', '喝水', 'he1 shui3', 'drink water', '💧', ['zh:t3', 'zh:sh']),
  henE: zi('我很饿', '我很餓', 'wo3 hen3 e4', 'I’m very hungry', '😫', ['zh:t3']),
  chiFan: zi('吃饭', '吃飯', 'chi1 fan4', 'eat a meal', '🍚', ['zh:t4', 'zh:sh']),
  kanDianshi: zi('看电视', '看電視', 'kan4 dian4 shi4', 'watch TV', '📺', ['zh:t4']),
  babaKanDianshi: zi('爸爸看电视。', '爸爸看電視。', 'ba4 ba5 kan4 dian4 shi4', 'Dad watches TV.', '📺', ['zh:t4']),
  kanShu: zi('看书', '看書', 'kan4 shu1', 'read a book', '📖', ['zh:sh']),
  xiaYu: zi('下雨', '下雨', 'xia4 yu3', 'it’s raining', '🌧️', ['zh:ü']),
  nvhaiQuXuexiao: zi('女孩去学校。', '女孩去學校。', 'nv3 hai2 qu4 xue2 xiao4', 'The girl goes to school.', '🏫', ['zh:ü']),
  heNiunai: zi('喝牛奶', '喝牛奶', 'he1 niu2 nai3', 'drink milk', '🥛', ['zh:n']),
  niLaiLe: zi('你来了', '你來了', 'ni3 lai2 le5', 'you’re here', '🙌', ['zh:n']),
  nainaiHeNiunai: zi('奶奶喝牛奶。', '奶奶喝牛奶。', 'nai3 nai5 he1 niu2 nai3', 'Grandma drinks milk.', '👵', ['zh:n']),
  xiangHeTang: zi('我想喝汤。', '我想喝湯。', 'wo3 xiang3 he1 tang1', 'I’d like some soup.', '🍲', ['zh:-ng']),
  chiJidan: zi('吃鸡蛋', '吃雞蛋', 'chi1 ji1 dan4', 'eat an egg', '🥚', ['zh:j']),
  qiZhiJi: zi('七只鸡', '七隻雞', 'qi1 zhi1 ji1', 'seven chickens', '🐔', ['zh:j', 'zh:sh']),
  xihuanXigua: zi('我喜欢吃西瓜。', '我喜歡吃西瓜。', 'wo3 xi3 huan5 chi1 xi1 gua1', 'I like eating watermelon.', '🍉', ['zh:j']),
};

// Lines the teacher says in dialogues.
const T = {
  niYaoShenme: zi('你要什么？', '你要什麼？', 'ni3 yao4 shen2 me5', 'What do you want?'),
  geiNi: zi('给你！', '給你！', 'gei3 ni3', 'Here you are!'),
  niHaoHeShenme: zi('你好！你想喝什么？', '你好！你想喝什麼？', 'ni3 hao3 ni3 xiang3 he1 shen2 me5', 'Hello! What would you like to drink?'),
  niEMa: zi('你饿吗？', '你餓嗎？', 'ni3 e4 ma5', 'Are you hungry?'),
  qingwenChiShenme: zi('你好！请问你想吃什么？', '你好！請問你想吃什麼？', 'ni3 hao3 qing3 wen4 ni3 xiang3 chi1 shen2 me5', 'Hello! What would you like to eat?'),
  xiangHeShenme: zi('你想喝什么？', '你想喝什麼？', 'ni3 xiang3 he1 shen2 me5', 'What would you like to drink?'),
  haochiMa: zi('好吃吗？', '好吃嗎？', 'hao3 chi1 ma5', 'Is it tasty?'),
};

const lesson = (id: string, title: string, icon: string, kind: Lesson['kind'], exercises: Lesson['exercises']): Lesson => ({
  id, unitId: 'zh-food', title, icon, kind, exercises,
});

const W = ZW;
const P = ZP;

const foodLessons: Lesson[] = [
  lesson('zh-food-1', 'Key words', '🍎', 'words', {
    little: [speak(W.shui), speak(W.niunai), heard(W.niunai, W.shui, W.pingguo), speak(W.pingguo), speak(W.xiangjiao), speak(W.yu)],
    junior: [speak(W.mianbao), speak(W.jidan), heard(W.jidan, W.mianbao, W.mifan), speak(W.mifan), speak(W.miantiao), speak(W.guozhi)],
    teen: [speak(W.qiaokeli), speak(W.bingqilin), heard(W.bingqilin, W.qiaokeli, W.dangao), speak(W.dangao), speak(W.jiaozi), speak(W.xigua)],
  }),
  lesson('zh-food-2', 'Useful phrases', '💬', 'phrases', {
    little: [speak(P.woYaoShui), speak(P.xiexie), heard(P.xiexie, P.zaijian), speak(P.zaijian), speak(P.haochi)],
    junior: [speak(P.xiangHeShui), speak(P.yaoPingguo), heard(P.xiangHeShui, P.yaoPingguo, P.eLe), speak(P.eLe), speak(P.bukeqi)],
    teen: [speak(P.qingGei), speak(P.xiangChiShenme), heard(P.xihuanYu, P.qingGei, P.henHaochi), speak(P.xihuanYu), speak(P.henHaochi)],
  }),
  lesson('zh-food-3', 'The four tones', '🎵', 'pronunciation', {
    little: [pair(W.ma1, W.ma3, 0, 'zh:t1'), speak(W.ma1), speak(W.ma3), speak(W.tang), pair(W.tang, W.tangSweet, 1, 'zh:t2')],
    junior: [pair(W.mai3, W.mai4, 0, 'zh:t3'), speak(W.mai3), speak(W.mai4), speak(W.tangSweet), speak(P.yaoTang)],
    // 诗/丝 rather than 十/四, and 電視 rather than 十: see sishisi below — the scorer cannot handle a run of sì and
    // shí, and 十 on its own sits just under the bar, so neither could be played to the learner at all.
    teen: [pair(W.shi1, W.si1, 0, 'zh:sh'), speak(W.shi4), speak(W.si4), speak(W.dianshi), speak(P.qingGei)],
  }),
  lesson('zh-food-4', 'Listen closely', '👂', 'listening', {
    little: [heard(W.xiangjiao, W.pingguo, W.yu), pair(W.ma1, W.ma3, 1, 'zh:t3'), heard(W.shui, W.niunai, W.xiangjiao), speak(W.yu)],
    junior: [pair(W.shi1, W.si1, 0, 'zh:sh'), heard(W.miantiao, W.mifan, W.mianbao), pair(W.tang, W.tangSweet, 0, 'zh:t1'), pair(W.shi4, W.si4, 1, 'zh:sh'), speak(W.si4)],
    // 诗/丝, not 十/四: 十 alone scores 83 against the teacher's floor of 85, so it cannot be played (eval/teacher-gate.mjs).
    teen: [pair(W.shi1, W.si1, 1, 'zh:sh'), pair(W.mai3, W.mai4, 1, 'zh:t4'), heard(P.xihuanYu, P.xiangHeShui, P.henHaochi), pair(W.ni3, W.li3, 0, 'zh:n'), speak(P.nihao)],
  }),
  lesson('zh-food-5', 'Say what you see', '🗣️', 'speaking', {
    little: [speak(W.pingguo, 'image'), speak(W.shui, 'image'), speak(W.yu, 'image'), speak(W.xiangjiao, 'image')],
    junior: [speak(W.miantiao, 'image'), speak(W.jidan, 'image'), speak(W.guozhi, 'image'), speak(W.dangao, 'image')],
    teen: [speak(W.bingqilin, 'image'), speak(W.qiaokeli, 'image'), speak(W.jiaozi, 'image'), speak(W.xigua, 'image')],
  }),
  lesson('zh-food-6', 'At the café', '🍵', 'conversation', {
    little: [dialogue(T.niYaoShenme, '🧑‍🍳', P.woYaoShui, P.yaoTang), dialogue(T.geiNi, '🍽️', P.xiexie), dialogue(P.zaijian, '👋', P.zaijian)],
    junior: [dialogue(T.niHaoHeShenme, '🧑‍🍳', P.xiangHeShui, P.heGuozhi), dialogue(T.niEMa, '😋', P.eLe, P.buE), dialogue(T.geiNi, '🛎️', P.xiexie)],
    teen: [dialogue(T.qingwenChiShenme, '🧑‍🍳', P.xihuanYu, P.chiMiantiao), dialogue(T.xiangHeShenme, '🍵', P.qingGei, P.heCha), dialogue(T.haochiMa, '😋', P.henHaochi, P.haochiXiexie)],
  }),
  lesson('zh-food-7', 'Review', '🏆', 'review', {
    little: [speak(W.pingguo, 'image'), speak(W.ma1), speak(P.xiexie), speak(P.woYaoShui)],
    junior: [speak(P.xiangHeShui), speak(W.mai3), speak(W.tang), speak(P.yaoPingguo)],
    teen: [speak(W.shizi), speak(P.qingGei), speak(P.xihuanYu), speak(P.henHaochi)],
  }),
];

const lockedUnit = (id: string, title: string, subtitle: string, icon: string, color: string, grownUp?: Unit['grownUp']): Unit => ({ id, title, subtitle, icon, color, lessons: [], locked: true, grownUp });

export const ZH_COURSE: Course = {
  id: 'putonghua-adventure',
  title: 'Putonghua Adventure',
  grownUpTitle: 'Putonghua',
  language: 'zh',
  units: [
    { id: 'zh-food', title: 'Yummy Food 好吃的', subtitle: 'Order food and drinks in Putonghua', icon: '🥢', color: 'var(--coral)', lessons: foodLessons, grownUp: { title: 'Food & Drink 饮食', subtitle: 'Order food and drinks in Putonghua' } },
    lockedUnit('zh-family', 'My Family 我的家', 'Mum, dad, grandma and me', '👨‍👩‍👧', 'var(--sky)', { title: 'Family 家人', subtitle: 'Talk about the people in your life' }),
    lockedUnit('zh-animals', 'Animals 动物', 'Pandas, tigers and pets', '🐼', 'var(--leaf)', { title: 'Animals 动物', subtitle: 'Pets, farms and wildlife' }),
    lockedUnit('zh-school', 'At School 学校', 'Classroom words and questions', '🎒', 'var(--sun)', { title: 'School & Study 学校', subtitle: 'Classroom words and questions' }),
  ],
};

/** Short speaking check the first time a child opens the Mandarin course. */
export const ZH_CHECK_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = {
  little: [W.ma1, W.shui, P.xiexie],
  junior: [W.ma1, W.si4, P.xiangHeShui, W.yu],
  // The very first thing a teenager says in Mandarin. It held 十 and 四是四，十是十。 — the two items in the whole
  // course the teacher's voice cannot say, so two of these three played nothing at all.
  teen: [W.shi4, P.xihuanYu, P.qingGei],
};

// ---------- Pronunciation Lab: sound → syllables → words → phrases → sentence ----------
type Ladder = Record<LabStage, SpeakItem[]>;
const L = (syllables: SpeakItem[], words: SpeakItem[], phrases: SpeakItem[], sentence: SpeakItem): Ladder => ({ syllables, words, phrases, sentence: [sentence] });

export const ZH_LADDERS: Record<PhonemeId, Ladder> = {
  'zh:t1': L([W.ma1, W.ba1, W.chi1], [W.xiangjiao, W.xigua, W.kafei], [P.heTang, P.chiXiangjiao], P.mamaHeTang),
  'zh:t2': L([W.ma2, W.cha, W.yu], [W.xuexi, W.xiongmao, W.piqiu], [P.heCha2, P.chiYu], P.xiongmaoHeCha),
  'zh:t3': L([W.ma3, W.mi3, W.gou3], [W.shui, W.xiaogou, W.laohu], [P.heShui, P.henE], P.xiangHeShui),
  'zh:t4': L([W.da4, W.ba4, W.si4], [W.zaijian, W.dianshi, W.dangao], [P.chiFan, P.kanDianshi], P.babaKanDianshi),
  'zh:sh': L([W.zhi1, W.chi1, W.shi1], [W.shu1, W.cha, W.shizi], [P.chiFan, P.kanShu], P.qingGei),
  'zh:j': L([W.ji1, W.qi1, W.xi1], [W.jidan, W.xigua, W.qiaokeli], [P.chiJidan, P.qiZhiJi], P.xihuanXigua),
  'zh:ü': L([W.yu, W.nv3, W.lv4], [W.juzi, W.qu4, W.xue2], [P.chiYu, P.xiaYu], P.nvhaiQuXuexiao),
  'zh:n': L([W.ni3, W.li3, W.niu2], [W.niunai, W.lanse, W.nainai], [P.heNiunai, P.niLaiLe], P.nainaiHeNiunai),
  'zh:-ng': L([W.tang, W.tangSweet, W.bing1], [W.xiangjiao, W.pingguo, W.mianbao], [P.heTang, P.chiXiangjiao], P.xiangHeTang),
};

export const ZH_LAB_SOUNDS: PhonemeId[] = ['zh:t3', 'zh:sh', 'zh:t2', 'zh:t1', 'zh:t4', 'zh:n', 'zh:ü', 'zh:j', 'zh:-ng'];

/** Every Mandarin item, for indexing and for the accuracy test set. */
export const ZH_ITEMS: SpeakItem[] = [...new Map([...Object.values(ZW), ...Object.values(ZP), ...Object.values(T)].map((it) => [it.id, it])).values()];
