import type { Scenario } from '../scenarios';
import { zhLine, zi } from './course';

// Conversations in Putonghua, for the Mandarin course (Leslie, 2026-09-21: "conversation practice is only in english,
// even when putonghua is selected — it should follow the language to learn").
//
// The same three scenes as the English course, told the Chinese way, and the words are the course's own wherever
// possible (水, 牛奶, 饺子, 面条, 熊猫, 老虎…), so a conversation is where the lesson words get used. Lines are short:
// a five-year-old answers in two or three characters, and nobody is asked anything real about themselves — the
// friend has a pretend name (小文) and asks about colours and games.
//
// Every line is a `zi` item — Simplified for the scorer, Traditional for a Hong Kong reader, numbered pinyin with
// citation tones (tone changes such as 一位 yí wèi and 不是 bú shì are computed, never typed). Animals take 它 in
// Simplified and 牠 in Traditional, as a Hong Kong textbook writes it.

const T = {
  // The dumpling house
  niHaoEMa: zi('你好！你饿吗？', '你好！你餓嗎？', 'ni3 hao3 ni3 e4 ma5', 'Hello! Are you hungry?'),
  xiangHe: zi('你想喝什么？', '你想喝什麼？', 'ni3 xiang3 he1 shen2 me5', 'What would you like to drink?'),
  xiangChi: zi('你想吃什么？', '你想吃什麼？', 'ni3 xiang3 chi1 shen2 me5', 'What would you like to eat?'),
  geiNi: zi('给你！', '給你！', 'gei3 ni3', 'Here you are!'),
  huanyingEMa: zi('你好！欢迎！你饿吗？', '你好！歡迎！你餓嗎？', 'ni3 hao3 huan1 ying2 ni3 e4 ma5', 'Hello! Welcome! Are you hungry?'),
  haodeChi: zi('好的！你想吃什么？', '好的！你想吃什麼？', 'hao3 de5 ni3 xiang3 chi1 shen2 me5', 'OK! What would you like to eat?'),
  manYong: zi('给你，请慢用！', '給你，請慢用！', 'gei3 ni3 qing3 man4 yong4', 'Here you are. Enjoy!'),
  guanglinJiwei: zi('你好，欢迎光临！请问几位？', '你好，歡迎光臨！請問幾位？', 'ni3 hao3 huan1 ying2 guang1 lin2 qing3 wen4 ji3 wei4', 'Hello, welcome! How many of you?'),
  qingZuo: zi('好的，请坐。你想喝点什么？', '好的，請坐。你想喝點什麼？', 'hao3 de5 qing3 zuo4 ni3 xiang3 he1 dian3 shen2 me5', 'Please sit down. What would you like to drink?'),
  meiWenti: zi('没问题。你想吃什么？', '沒問題。你想吃什麼？', 'mei2 wen4 ti2 ni3 xiang3 chi1 shen2 me5', 'No problem. What would you like to eat?'),
  caiLaiLe: zi('你的菜来了，好吃吗？', '你的菜來了，好吃嗎？', 'ni3 de5 cai4 lai2 le5 hao3 chi1 ma5', 'Here is your food. Is it tasty?'),

  // Panda Park
  xihuanDongwu: zi('你好！你喜欢动物吗？', '你好！你喜歡動物嗎？', 'ni3 hao3 ni3 xi3 huan5 dong4 wu4 ma5', 'Hello! Do you like animals?'),
  zheShiShenme: zi('看！这是什么？', '看！這是什麼？', 'kan4 zhe4 shi4 shen2 me5', 'Look! What is this?'),
  xihuanTa: zi('你喜欢它吗？', '你喜歡牠嗎？', 'ni3 xi3 huan5 ta1 ma5', 'Do you like it?'),
  yaoZouLe: zi('我们要走了。再见！', '我們要走了。再見！', 'wo3 men5 yao4 zou3 le5 zai4 jian4', 'We have to go now. Goodbye!'),
  huanyingDongwuyuan: zi('欢迎来动物园！你喜欢动物吗？', '歡迎來動物園！你喜歡動物嗎？', 'huan1 ying2 lai2 dong4 wu4 yuan2 ni3 xi3 huan5 dong4 wu4 ma5', 'Welcome to the zoo! Do you like animals?'),
  nabianYou: zi('你看，那边有什么？', '你看，那邊有什麼？', 'ni3 kan4 na4 bian1 you3 shen2 me5', 'Look, what is over there?'),
  zuiXihuan: zi('哇！你最喜欢什么动物？', '哇！你最喜歡什麼動物？', 'wa1 ni3 zui4 xi3 huan5 shen2 me5 dong4 wu4', 'Wow! Which animal do you like best?'),
  kaixinMa: zi('我们要走了。你开心吗？', '我們要走了。你開心嗎？', 'wo3 men5 yao4 zou3 le5 ni3 kai1 xin1 ma5', 'We have to go now. Did you have fun?'),
  diYiCi: zi('欢迎来到动物园！你是第一次来吗？', '歡迎來到動物園！你是第一次來嗎？', 'huan1 ying2 lai2 dao4 dong4 wu4 yuan2 ni3 shi4 di4 yi1 ci4 lai2 ma5', 'Welcome to the zoo! Is this your first visit?'),
  xianKan: zi('你想先看什么动物？', '你想先看什麼動物？', 'ni3 xiang3 xian1 kan4 shen2 me5 dong4 wu4', 'Which animal would you like to see first?'),
  zuiXihuanTeen: zi('你最喜欢什么动物？', '你最喜歡什麼動物？', 'ni3 zui4 xi3 huan5 shen2 me5 dong4 wu4', 'Which animal do you like best?'),
  guanMen: zi('我们快要关门了。今天玩得开心吗？', '我們快要關門了。今天玩得開心嗎？', 'wo3 men5 kuai4 yao4 guan1 men2 le5 jin1 tian1 wan2 de5 kai1 xin1 ma5', 'We close soon. Did you have fun today?'),

  // A new friend
  woJiaoXiaowen: zi('你好！我叫小文。', '你好！我叫小文。', 'ni3 hao3 wo3 jiao4 xiao3 wen2', 'Hi! I’m Xiaowen.'),
  hongseNiNe: zi('我喜欢红色。你呢？', '我喜歡紅色。你呢？', 'wo3 xi3 huan5 hong2 se4 ni3 ne5', 'I like red. What about you?'),
  yiqiWan: zi('我们一起玩吧！', '我們一起玩吧！', 'wo3 men5 yi1 qi3 wan2 ba5', 'Let’s play together!'),
  renshiNi: zi('你好！我叫小文，很高兴认识你！', '你好！我叫小文，很高興認識你！', 'ni3 hao3 wo3 jiao4 xiao3 wen2 hen3 gao1 xing4 ren4 shi5 ni3', 'Hi! I’m Xiaowen. Nice to meet you!'),
  yanse: zi('我最喜欢红色。你最喜欢什么颜色？', '我最喜歡紅色。你最喜歡什麼顏色？', 'wo3 zui4 xi3 huan5 hong2 se4 ni3 zui4 xi3 huan5 shen2 me5 yan2 se4', 'My favourite colour is red. What’s yours?'),
  genWoWan: zi('太好了！你想跟我一起玩吗？', '太好了！你想跟我一起玩嗎？', 'tai4 hao3 le5 ni3 xiang3 gen1 wo3 yi1 qi3 wan2 ma5', 'Great! Do you want to play with me?'),
  meiJianguo: zi('嗨！我叫小文。我们好像没见过。', '嗨！我叫小文。我們好像沒見過。', 'hai1 wo3 jiao4 xiao3 wen2 wo3 men5 hao3 xiang4 mei2 jian4 guo4', 'Hi! I’m Xiaowen. I don’t think we’ve met.'),
  zuqiu: zi('我很喜欢踢足球。你平时喜欢做什么？', '我很喜歡踢足球。你平時喜歡做什麼？', 'wo3 hen3 xi3 huan5 ti1 zu2 qiu2 ni3 ping2 shi2 xi3 huan5 zuo4 shen2 me5', 'I really like football. What do you like doing?'),
  yiqiLai: zi('不错！我们在那边踢球，你要一起来吗？', '不錯！我們在那邊踢球，你要一起來嗎？', 'bu4 cuo4 wo3 men5 zai4 na4 bian1 ti1 qiu2 ni3 yao4 yi1 qi3 lai2 ma5', 'Nice! We’re playing over there. Want to join us?'),
};

/** What the learner can say back. */
const R = {
  // The dumpling house
  yaoNiunai: zi('我要牛奶。', '我要牛奶。', 'wo3 yao4 niu2 nai3', 'I want milk.', '🥛'),
  yaoMianbao: zi('我要面包。', '我要麵包。', 'wo3 yao4 mian4 bao1', 'I want bread.', '🍞'),
  henE: zi('我很饿。', '我很餓。', 'wo3 hen3 e4', 'I’m very hungry.', '😋'),
  yidianE: zi('我有一点饿。', '我有一點餓。', 'wo3 you3 yi1 dian3 e4', 'I’m a little hungry.', '🤏'),
  chiJiaozi: zi('我想吃饺子。', '我想吃餃子。', 'wo3 xiang3 chi1 jiao3 zi5', 'I’d like dumplings.', '🥟'),
  xiexieNi: zi('谢谢你！', '謝謝你！', 'xie4 xie5 ni3', 'Thank you!', '💛'),
  yiWei: zi('一位，谢谢。', '一位，謝謝。', 'yi1 wei4 xie4 xie5', 'Just one, thank you.', '☝️'),
  liangWei: zi('两位。', '兩位。', 'liang3 wei4', 'Two of us.', '✌️'),
  youShenmeHaochi: zi('你们有什么好吃的？', '你們有什麼好吃的？', 'ni3 men5 you3 shen2 me5 hao3 chi1 de5', 'What’s good here?', '🤔'),
  feichangHaochi: zi('非常好吃！', '非常好吃！', 'fei1 chang2 hao3 chi1', 'Really tasty!', '😋'),

  // Panda Park
  xihuan: zi('喜欢！', '喜歡！', 'xi3 huan5', 'I do!', '💛'),
  // 我喜欢！ on its own defeats the teacher's voice (refused twice by the quality gate); these two it says cleanly.
  xihuanDongwu: zi('我喜欢动物！', '我喜歡動物！', 'wo3 xi3 huan5 dong4 wu4', 'I like animals!', '🐾'),
  xihuanTa: zi('我喜欢它！', '我喜歡牠！', 'wo3 xi3 huan5 ta1', 'I like it!', '😊'),
  xiongmao: zi('熊猫！', '熊貓！', 'xiong2 mao1', 'A panda!', '🐼'),
  laohu: zi('老虎！', '老虎！', 'lao3 hu3', 'A tiger!', '🐯'),
  keai: zi('很可爱！', '很可愛！', 'hen3 ke3 ai4', 'So cute!', '🥰'),
  henXihuanDongwu: zi('我很喜欢动物。', '我很喜歡動物。', 'wo3 hen3 xi3 huan5 dong4 wu4', 'I really like animals.', '🐾'),
  zuiXihuanXiongmao: zi('我最喜欢熊猫。', '我最喜歡熊貓。', 'wo3 zui4 xi3 huan5 xiong2 mao1', 'I like pandas best.', '🐼'),
  sanZhiLaohu: zi('那边有三只老虎。', '那邊有三隻老虎。', 'na4 bian1 you3 san1 zhi1 lao3 hu3', 'There are three tigers over there.', '🐯'),
  kandaoHouzi: zi('我看到一只猴子。', '我看到一隻猴子。', 'wo3 kan4 dao4 yi1 zhi1 hou2 zi5', 'I can see a monkey.', '🐒'),
  xihuanDaxiang: zi('我喜欢大象。', '我喜歡大象。', 'wo3 xi3 huan5 da4 xiang4', 'I like elephants.', '🐘'),
  henKaixin: zi('很开心，谢谢！', '很開心，謝謝！', 'hen3 kai1 xin1 xie4 xie5', 'I had fun, thank you!', '😄'),
  kaixinXiexieNi: zi('开心！谢谢你！', '開心！謝謝你！', 'kai1 xin1 xie4 xie5 ni3', 'Yes! Thank you!', '😄'),
  diYiCiLai: zi('是的，我第一次来。', '是的，我第一次來。', 'shi4 de5 wo3 di4 yi1 ci4 lai2', 'Yes, it’s my first time.', '🆕'),
  changchangLai: zi('不是，我常常来。', '不是，我常常來。', 'bu4 shi4 wo3 chang2 chang2 lai2', 'No, I come often.', '🔁'),
  xianKanXiongmao: zi('我想先看熊猫。', '我想先看熊貓。', 'wo3 xiang3 xian1 kan4 xiong2 mao1', 'I’d like to see the pandas first.', '🐼'),
  kanLaohu: zi('我想看老虎。', '我想看老虎。', 'wo3 xiang3 kan4 lao3 hu3', 'I’d like to see the tigers.', '🐯'),
  xiongmaoZuiKeai: zi('我觉得熊猫最可爱。', '我覺得熊貓最可愛。', 'wo3 jue2 de5 xiong2 mao1 zui4 ke3 ai4', 'I think pandas are the cutest.', '🐼'),
  zuiXihuanDaxiang: zi('我最喜欢大象。', '我最喜歡大象。', 'wo3 zui4 xi3 huan5 da4 xiang4', 'I like elephants best.', '🐘'),
  henKaixinXiexieNi: zi('很开心，谢谢你！', '很開心，謝謝你！', 'hen3 kai1 xin1 xie4 xie5 ni3', 'I had fun, thank you!', '😄'),
  henHaowan: zi('今天很好玩！', '今天很好玩！', 'jin1 tian1 hen3 hao3 wan2', 'Today was great fun!', '🎉'),

  // A new friend
  // 你好，小文！ is refused by the teacher's quality gate every time; with 呀 it is said cleanly.
  niHaoXiaowen: zi('你好呀，小文！', '你好呀，小文！', 'ni3 hao3 ya5 xiao3 wen2', 'Hi, Xiaowen!', '👋'),
  yeXihuanHongse: zi('我也喜欢红色。', '我也喜歡紅色。', 'wo3 ye3 xi3 huan5 hong2 se4', 'I like red too.', '🔴'),
  xihuanHuangse: zi('我喜欢黄色。', '我喜歡黃色。', 'wo3 xi3 huan5 huang2 se4', 'I like yellow.', '🟡'),
  haoA: zi('好啊！', '好啊！', 'hao3 a5', 'OK!', '👍'),
  haoYiqiWan: zi('好！一起玩！', '好！一起玩！', 'hao3 yi1 qi3 wan2', 'Yes! Let’s play!', '🤸'),
  gaoxing: zi('很高兴认识你。', '很高興認識你。', 'hen3 gao1 xing4 ren4 shi5 ni3', 'Nice to meet you.', '🤝'),
  zuiXihuanLanse: zi('我最喜欢蓝色。', '我最喜歡藍色。', 'wo3 zui4 xi3 huan5 lan2 se4', 'My favourite is blue.', '🔵'),
  haoAWoXiangWan: zi('好啊，我想玩！', '好啊，我想玩！', 'hao3 a5 wo3 xiang3 wan2', 'Yes, I want to play!', '🤸'),
  womenYiqiWan: zi('好，我们一起玩吧。', '好，我們一起玩吧。', 'hao3 wo3 men5 yi1 qi3 wan2 ba5', 'OK, let’s play together.', '🤝'),
  niHaoGaoxing: zi('你好，很高兴认识你。', '你好，很高興認識你。', 'ni3 hao3 hen3 gao1 xing4 ren4 shi5 ni3', 'Hi, nice to meet you.', '🤝'),
  xinLaiDe: zi('是的，我是新来的。', '是的，我是新來的。', 'shi4 de5 wo3 shi4 xin1 lai2 de5', 'Yes, I’m new here.', '🆕'),
  yeXihuanZuqiu: zi('我也喜欢踢足球。', '我也喜歡踢足球。', 'wo3 ye3 xi3 huan5 ti1 zu2 qiu2', 'I like football too.', '⚽'),
  kanShuHuahua: zi('我喜欢看书和画画。', '我喜歡看書和畫畫。', 'wo3 xi3 huan5 kan4 shu1 he2 hua4 hua4', 'I like reading and drawing.', '🎨'),
  haoAXiexieNi: zi('好啊，谢谢你！', '好啊，謝謝你！', 'hao3 a5 xie4 xie5 ni3', 'Sure, thank you!', '😊'),
  henXiangQu: zi('我很想去，谢谢！', '我很想去，謝謝！', 'wo3 hen3 xiang3 qu4 xie4 xie5', 'I’d love to, thanks!', '😊'),
};

/** How each scene ends. */
const BYE = {
  zaijian: zhLine('zh-zai4-jian4-s'),
  huanyingZaiLai: zi('再见！欢迎再来！', '再見！歡迎再來！', 'zai4 jian4 huan1 ying2 zai4 lai2', 'Goodbye! Come again!'),
  xiaCiJian: zi('谢谢光临，下次见！', '謝謝光臨，下次見！', 'xie4 xie5 guang1 lin2 xia4 ci4 jian4', 'Thanks for coming. See you next time!'),
  xiexieNiLai: zi('谢谢你来！再见！', '謝謝你來！再見！', 'xie4 xie5 ni3 lai2 zai4 jian4', 'Thanks for coming! Goodbye!'),
  laiDongwuyuan: zi('谢谢你来动物园，再见！', '謝謝你來動物園，再見！', 'xie4 xie5 ni3 lai2 dong4 wu4 yuan2 zai4 jian4', 'Thanks for visiting the zoo. Goodbye!'),
  guanglinZaijian: zi('谢谢你的光临，再见！', '謝謝你的光臨，再見！', 'xie4 xie5 ni3 de5 guang1 lin2 zai4 jian4', 'Thank you for visiting. Goodbye!'),
  zhenHaowan: zi('真好玩！再见！', '真好玩！再見！', 'zhen1 hao3 wan2 zai4 jian4', 'That was fun! Goodbye!'),
  mingtianJian: zi('今天真开心！明天见！', '今天真開心！明天見！', 'jin1 tian1 zhen1 kai1 xin1 ming2 tian1 jian4', 'That was fun today! See you tomorrow!'),
  huitouJian: zi('太好了，回头见！', '太好了，回頭見！', 'tai4 hao3 le5 hui2 tou2 jian4', 'Great, see you around!'),
};

export const ZH_SCENARIOS: Scenario[] = [
  {
    id: 'zh-cafe', course: 'zh', title: 'The Dumpling House', icon: '🥟', color: 'var(--coral)',
    blurb: { little: 'Ask for yummy food in Putonghua!', junior: 'Order a drink and dumplings in Putonghua.', teen: 'Get a table, order and chat with the waiter in Putonghua.' },
    setting: 'A friendly Chinese restaurant. The learner is a customer ordering food and drink, in Putonghua.',
    tutorRole: 'a cheerful waiter at a dumpling house',
    goals: ['greet', 'order a drink', 'order food', 'say thank you'],
    turns: [
      {
        tutor: { little: T.niHaoEMa, junior: T.huanyingEMa, teen: T.guanglinJiwei },
        replies: { little: [zhLine('zh-wo3-e4-le5-s'), zhLine('zh-ni3-hao3-s')], junior: [R.henE, R.yidianE], teen: [R.yiWei, R.liangWei] },
      },
      {
        tutor: { little: T.xiangHe, junior: T.xiangHe, teen: T.qingZuo },
        replies: { little: [zhLine('zh-wo3-yao4-shui3-s'), R.yaoNiunai], junior: [zhLine('zh-wo3-xiang3-he1-guo3-zhi1-s'), zhLine('zh-wo3-xiang3-he1-shui3-s')], teen: [zhLine('zh-qing3-gei3-wo3-yi1-bei1-shui3-s'), zhLine('zh-wo3-xiang3-he1-cha2-s')] },
      },
      {
        tutor: { little: T.xiangChi, junior: T.haodeChi, teen: T.meiWenti },
        replies: { little: [zhLine('zh-wo3-yao4-ping2-guo3-s'), R.yaoMianbao], junior: [zhLine('zh-wo3-xiang3-chi1-mian4-tiao2-s'), R.chiJiaozi], teen: [zhLine('zh-wo3-xi3-huan5-chi1-yu2-s'), R.youShenmeHaochi] },
      },
      {
        tutor: { little: T.geiNi, junior: T.manYong, teen: T.caiLaiLe },
        replies: { little: [zhLine('zh-xie4-xie5-s')], junior: [R.xiexieNi], teen: [zhLine('zh-hen3-hao3-chi1-xie4-xie5-s'), R.feichangHaochi] },
      },
    ],
    closing: { little: BYE.zaijian, junior: BYE.huanyingZaiLai, teen: BYE.xiaCiJian },
  },
  {
    id: 'zh-zoo', course: 'zh', title: 'Panda Park', icon: '🐼', color: 'var(--leaf)',
    blurb: { little: 'Say hello to the pandas in Putonghua!', junior: 'Talk about the animals you see, in Putonghua.', teen: 'Plan your visit with a guide, in Putonghua.' },
    setting: 'A zoo famous for its pandas. The learner is a visitor talking to a guide about the animals, in Putonghua.',
    tutorRole: 'a friendly zoo guide',
    goals: ['greet', 'name animals', 'say what you like', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.xihuanDongwu, junior: T.huanyingDongwuyuan, teen: T.diYiCi },
        replies: { little: [R.xihuan, R.xihuanDongwu], junior: [R.henXihuanDongwu, R.zuiXihuanXiongmao], teen: [R.diYiCiLai, R.changchangLai] },
      },
      {
        tutor: { little: T.zheShiShenme, junior: T.nabianYou, teen: T.xianKan },
        replies: { little: [R.xiongmao, R.laohu], junior: [R.sanZhiLaohu, R.kandaoHouzi], teen: [R.xianKanXiongmao, R.kanLaohu] },
      },
      {
        tutor: { little: T.xihuanTa, junior: T.zuiXihuan, teen: T.zuiXihuanTeen },
        replies: { little: [R.xihuanTa, R.keai], junior: [R.zuiXihuanXiongmao, R.xihuanDaxiang], teen: [R.xiongmaoZuiKeai, R.zuiXihuanDaxiang] },
      },
      {
        tutor: { little: T.yaoZouLe, junior: T.kaixinMa, teen: T.guanMen },
        replies: { little: [zhLine('zh-zai4-jian4-s'), zhLine('zh-xie4-xie5-s')], junior: [R.henKaixin, R.kaixinXiexieNi], teen: [R.henKaixinXiexieNi, R.henHaowan] },
      },
    ],
    closing: { little: BYE.xiexieNiLai, junior: BYE.laiDongwuyuan, teen: BYE.guanglinZaijian },
  },
  {
    id: 'zh-friend', course: 'zh', title: 'A New Friend', icon: '🪁', color: 'var(--sky)',
    blurb: { little: 'Say hi and play, in Putonghua!', junior: 'Meet a new friend at the park, in Putonghua.', teen: 'Make small talk with someone new, in Putonghua.' },
    setting: 'A park. The learner meets a friendly child called Xiaowen (小文) and talks about favourite things, in Putonghua (never real personal details).',
    tutorRole: 'Xiaowen, a friendly kid at the park',
    goals: ['greet', 'talk about favourite things', 'suggest playing', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.woJiaoXiaowen, junior: T.renshiNi, teen: T.meiJianguo },
        replies: { little: [R.niHaoXiaowen, zhLine('zh-ni3-hao3-s')], junior: [R.gaoxing, R.niHaoXiaowen], teen: [R.niHaoGaoxing, R.xinLaiDe] },
      },
      {
        tutor: { little: T.hongseNiNe, junior: T.yanse, teen: T.zuqiu },
        replies: { little: [R.yeXihuanHongse, R.xihuanHuangse], junior: [R.zuiXihuanLanse, R.yeXihuanHongse], teen: [R.yeXihuanZuqiu, R.kanShuHuahua] },
      },
      {
        tutor: { little: T.yiqiWan, junior: T.genWoWan, teen: T.yiqiLai },
        replies: { little: [R.haoA, R.haoYiqiWan], junior: [R.haoAWoXiangWan, R.womenYiqiWan], teen: [R.haoAXiexieNi, R.henXiangQu] },
      },
    ],
    closing: { little: BYE.zhenHaowan, junior: BYE.mingtianJian, teen: BYE.huitouJian },
  },
];
