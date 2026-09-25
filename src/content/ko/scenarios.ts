import type { Scenario } from '../scenarios';
import { ko } from './item';

// Conversations in Korean, for the Korean course: the same three scenes as the English, Putonghua, French and
// Japanese courses.
//
// Register follows who is talking, as it would in Korea: shop staff and the zoo guide speak politely — 해요체 to a
// child, 합니다체 to a teen — and a child answers everyone in 해요체, which is polite without being stiff. The friend has
// a pretend name (민준) and asks only about colours and games, never real details. Every line carries its pronounced
// form beside what is written (같이 is said 가치, 좋아해요 is said 조아해요), so the voice, the scorer's alignment, the
// beats and the romaja all come from the same place (ko/hangul.ts). A learner's reply that is also a course line
// (물 주세요, 감사합니다.) is written identically here, so it shares the same id and the same progress.

const T = {
  // The Tteokbokki Shop
  baegopayo: ko('안녕하세요! 배고파요?', '안녕하세요 배고파요', 'annyeonghaseyo baegopayo', 'Hello! Are you hungry?'),
  eoseoOseyo: ko('어서 오세요! 배고파요?', '어서 오세요 배고파요', 'eoseo oseyo baegopayo', 'Welcome! Are you hungry?'),
  jumun: ko('어서 오십시오. 주문하시겠습니까?', '어서 오십씨오 주문하시겓씀니까', 'eoseo osipsio jumunhasigetseumnikka', 'Welcome. Would you like to order?'),
  masillaeyo: ko('뭐 마실래요?', '뭐 마실래요', 'mwo masillaeyo', 'What would you like to drink?'),
  uyuJuseu: ko('뭐 마실래요? 우유? 주스?', '뭐 마실래요 우유 주스', 'mwo masillaeyo uyu juseu', 'What would you like to drink? Milk? Juice?'),
  eumnyo: ko('음료는 뭐로 하시겠습니까?', '음뇨는 뭐로 하시겓씀니까', 'eumnyoneun mworo hasigetseumnikka', 'What would you like to drink?'),
  meogeullaeyo: ko('그리고 뭐 먹을래요?', '그리고 뭐 머글래요', 'geurigo mwo meogeullaeyo', 'And what would you like to eat?'),
  tteokbokkiMeogeullaeyo: ko('떡볶이 먹을래요?', '떡뽀끼 머글래요', 'tteokbokki meogeullaeyo', 'Would you like tteokbokki?'),
  siksa: ko('식사는 뭐로 하시겠습니까?', '식싸는 뭐로 하시겓씀니까', 'siksaneun mworo hasigetseumnikka', 'What would you like to eat?'),
  masitgeMeogeoyo: ko('여기 있어요. 맛있게 먹어요!', '여기 이써요 마싣께 머거요', 'yeogi isseoyo masitge meogeoyo', 'Here you are. Enjoy!'),
  masitgeDeuseyo: ko('여기 있어요. 맛있게 드세요!', '여기 이써요 마싣께 드세요', 'yeogi isseoyo masitge deuseyo', 'Here you are. Enjoy your meal!'),
  masitgeDeusipsio: ko('주문하신 음식입니다. 맛있게 드십시오.', '주문하신 음시김니다 마싣께 드십씨오', 'jumunhasin eumsigimnida masitge deusipsio', 'Here is your order. Enjoy your meal.'),

  // The Seoul Zoo
  dongmulJoahaeyo: ko('안녕하세요! 동물 좋아해요?', '안녕하세요 동물 조아해요', 'annyeonghaseyo dongmul joahaeyo', 'Hello! Do you like animals?'),
  hwanyeong: ko('동물원에 온 걸 환영해요! 동물 좋아해요?', '동무뤄네 온 걸 환영해요 동물 조아해요', 'dongmurwone on geol hwanyeonghaeyo dongmul joahaeyo', 'Welcome to the zoo! Do you like animals?'),
  cheoeum: ko('서울 동물원에 오신 것을 환영합니다. 처음 오셨습니까?', '서울 동무뤄네 오신 거슬 환영함니다 처음 오셛씀니까', 'seoul dongmurwone osin geoseul hwanyeonghamnida cheoeum osyeotseumnikka', 'Welcome to Seoul Zoo. Is this your first visit?'),
  mwoyeyo: ko('저기 봐요! 뭐예요?', '저기 봐요 뭐예요', 'jeogi bwayo mwoyeyo', 'Look over there! What is it?'),
  mwogaBoyeoyo: ko('저기 봐요! 뭐가 보여요?', '저기 봐요 뭐가 보여요', 'jeogi bwayo mwoga boyeoyo', 'Look over there! What can you see?'),
  mwobuteo: ko('호랑이하고 판다가 있습니다. 뭐부터 보시겠습니까?', '호랑이하고 판다가 읻씀니다 뭐부터 보시겓씀니까', 'horangihago pandaga itseumnida mwobuteo bosigetseumnikka', 'We have tigers and pandas. What would you like to see first?'),
  gwiyeopjyo: ko('귀엽죠?', '귀엽쬬', 'gwiyeopjyo', 'Cute, isn’t it?'),
  museunDongmul: ko('무슨 동물을 제일 좋아해요?', '무슨 동무를 제일 조아해요', 'museun dongmureul jeil joahaeyo', 'Which animal do you like best?'),
  eotteonDongmul: ko('어떤 동물을 제일 좋아하십니까?', '어떤 동무를 제일 조아하심니까', 'eotteon dongmureul jeil joahasimnikka', 'Which animal do you like best?'),
  galSigan: ko('이제 갈 시간이에요. 안녕!', '이제 갈 씨가니에요 안녕', 'ije gal siganieyo annyeong', 'Time to go now. Bye!'),
  jaemiisseosseoyo: ko('곧 문을 닫아요. 재미있었어요?', '곧 무늘 다다요 재미이써써요', 'got muneul dadayo jaemiisseosseoyo', 'We close soon. Did you have fun?'),
  jeulgeousyeotseumnikka: ko('곧 문을 닫습니다. 즐거우셨습니까?', '곧 무늘 닫씀니다 즐거우셛씀니까', 'got muneul datseumnida jeulgeousyeotseumnikka', 'We close soon. Did you enjoy your visit?'),

  // A new friend
  minjun: ko('안녕하세요! 저는 민준이에요.', '안녕하세요 저는 민주니에요', 'annyeonghaseyo jeoneun minjunieyo', 'Hi! I’m Minjun.'),
  minjunBangawoyo: ko('안녕하세요! 저는 민준이에요. 만나서 반가워요.', '안녕하세요 저는 민주니에요 만나서 반가워요', 'annyeonghaseyo jeoneun minjunieyo mannaseo bangawoyo', 'Hi! I’m Minjun. Nice to meet you.'),
  cheoeumBojyo: ko('안녕하세요, 저는 민준이에요. 우리 처음 보죠?', '안녕하세요 저는 민주니에요 우리 처음 보죠', 'annyeonghaseyo jeoneun minjunieyo uri cheoeum bojyo', 'Hi, I’m Minjun. We haven’t met before, have we?'),
  ppalgansaek: ko('저는 빨간색을 좋아해요. 뭐 좋아해요?', '저는 빨간새글 조아해요 뭐 조아해요', 'jeoneun ppalgansaegeul joahaeyo mwo joahaeyo', 'I like red. What do you like?'),
  museunSaek: ko('제가 제일 좋아하는 색은 빨간색이에요. 무슨 색 좋아해요?', '제가 제일 조아하는 새근 빨간새기에요 무슨 색 조아해요', 'jega jeil joahaneun saegeun ppalgansaegieyo museun saek joahaeyo', 'My favourite colour is red. What colour do you like?'),
  chukgu: ko('저는 축구를 정말 좋아해요. 뭐 하는 걸 좋아해요?', '저는 축꾸를 정말 조아해요 뭐 하는 걸 조아해요', 'jeoneun chukgureul jeongmal joahaeyo mwo haneun geol joahaeyo', 'I really like football. What do you like doing?'),
  gachiNorayo: ko('같이 놀아요!', '가치 노라요', 'gachi norayo', 'Let’s play together!'),
  gachiNollaeyo: ko('좋아요! 같이 놀래요?', '조아요 가치 놀래요', 'joayo gachi nollaeyo', 'Great! Do you want to play together?'),
  gachiHallaeyo: ko('좋네요! 저기서 축구 하는데, 같이 할래요?', '존네요 저기서 축꾸 하는데 가치 할래요', 'jonneyo jeogiseo chukgu haneunde gachi hallaeyo', 'Nice! We’re playing football over there — want to join?'),
};

/** What the learner can say back — short, polite, and where a line is also a course line, spelt the same. */
const R = {
  // The Tteokbokki Shop
  neBaegopayo: ko('네, 배고파요.', '네 배고파요', 'ne baegopayo', 'Yes, I’m hungry.', '😋'),
  annyeonghaseyo: ko('안녕하세요.', '안녕하세요', 'annyeonghaseyo', 'Hello.', '👋'),
  jogeumBaegopayo: ko('조금 배고파요.', '조금 배고파요', 'jogeum baegopayo', 'I’m a little hungry.', '🤏'),
  jumunhalgeyo: ko('네, 주문할게요.', '네 주문할께요', 'ne jumunhalgeyo', 'Yes, I’d like to order.', '🙂'),
  menyu: ko('메뉴 좀 주세요.', '메뉴 좀 주세요', 'menyu jom juseyo', 'The menu, please.', '📋'),
  uyuJuseyo: ko('우유 주세요', '우유 주세요', 'uyu juseyo', 'Milk, please', '🥛'),
  mulJuseyo: ko('물 주세요', '물 주세요', 'mul juseyo', 'Water, please', '💧'),
  juseuJuseyo: ko('주스 주세요', '주스 주세요', 'juseu juseyo', 'Juice, please', '🧃'),
  mulHanJan: ko('물 한 잔 주세요.', '물 한 잔 주세요', 'mul han jan juseyo', 'A glass of water, please.', '💧'),
  keopiHanJan: ko('커피 한 잔 주세요.', '커피 한 잔 주세요', 'keopi han jan juseyo', 'A cup of coffee, please.', '☕'),
  tteokbokkiJuseyo: ko('떡볶이 주세요', '떡뽀끼 주세요', 'tteokbokki juseyo', 'Tteokbokki, please', '🌶️'),
  ppangJuseyo: ko('빵 주세요', '빵 주세요', 'ppang juseyo', 'Bread, please', '🍞'),
  neTteokbokki: ko('네, 떡볶이 주세요', '네 떡뽀끼 주세요', 'ne tteokbokki juseyo', 'Yes, tteokbokki, please', '🌶️'),
  gimbapJuseyo: ko('김밥 주세요', '김빱 주세요', 'gimbap juseyo', 'Gimbap, please', '🍙'),
  tteokbokkihagoGimbap: ko('떡볶이하고 김밥 주세요.', '떡뽀끼하고 김빱 주세요', 'tteokbokkihago gimbap juseyo', 'Tteokbokki and gimbap, please.', '🍙'),
  ramyeonJuseyo: ko('라면 주세요', '라면 주세요', 'ramyeon juseyo', 'Ramyeon, please', '🍜'),
  gamsahamnida: ko('감사합니다.', '감사함니다', 'gamsahamnida', 'Thank you.', '🙏'),
  jalMeokgetseumnida: ko('잘 먹겠습니다.', '잘 먹껟씀니다', 'jal meokgetseumnida', 'Thank you for the meal (said before eating).', '🙏'),
  gamsahamnidaJalMeokgetseumnida: ko('감사합니다. 잘 먹겠습니다.', '감사함니다 잘 먹껟씀니다', 'gamsahamnida jal meokgetseumnida', 'Thank you. I’ll enjoy this.', '🙏'),
  jeongmalMasisseoyo: ko('정말 맛있어요!', '정말 마시써요', 'jeongmal masisseoyo', 'It’s really delicious!', '🤩'),

  // The Seoul Zoo
  neJoahaeyo: ko('네, 좋아해요!', '네 조아해요', 'ne joahaeyo', 'Yes, I like them!', '😊'),
  dongmureulJoahaeyo: ko('네, 동물을 좋아해요.', '네 동무를 조아해요', 'ne dongmureul joahaeyo', 'Yes, I like animals.', '🐾'),
  jeongmalJoahaeyo: ko('네, 정말 좋아해요.', '네 정말 조아해요', 'ne jeongmal joahaeyo', 'Yes, I really like them.', '💛'),
  cheoeumieyo: ko('네, 처음이에요.', '네 처으미에요', 'ne cheoeumieyo', 'Yes, it’s my first time.', '🆕'),
  duBeonjjae: ko('아니요, 두 번째예요.', '아니요 두 번째예요', 'aniyo du beonjjaeyeyo', 'No, it’s my second time.', '✌️'),
  horangi: ko('호랑이!', '호랑이', 'horangi', 'A tiger!', '🐯'),
  panda: ko('판다!', '판다', 'panda', 'A panda!', '🐼'),
  horangigaBoyeoyo: ko('호랑이가 보여요.', '호랑이가 보여요', 'horangiga boyeoyo', 'I can see a tiger.', '🐯'),
  pandagaBoyeoyo: ko('판다가 보여요.', '판다가 보여요', 'pandaga boyeoyo', 'I can see a panda.', '🐼'),
  horangibuteo: ko('호랑이부터 보고 싶어요.', '호랑이부터 보고 시퍼요', 'horangibuteo bogo sipeoyo', 'I’d like to see the tigers first.', '🐯'),
  pandabuteo: ko('판다부터 볼게요.', '판다부터 볼께요', 'pandabuteo bolgeyo', 'I’ll see the pandas first.', '🐼'),
  neGwiyeowoyo: ko('네, 귀여워요!', '네 귀여워요', 'ne gwiyeowoyo', 'Yes, it’s cute!', '🥰'),
  neomuGwiyeowoyo: ko('너무 귀여워요!', '너무 귀여워요', 'neomu gwiyeowoyo', 'It’s so cute!', '😍'),
  pandareulJeil: ko('저는 판다를 제일 좋아해요.', '저는 판다를 제일 조아해요', 'jeoneun pandareul jeil joahaeyo', 'I like pandas best.', '🐼'),
  horangireulJoahaeyo: ko('저는 호랑이를 좋아해요.', '저는 호랑이를 조아해요', 'jeoneun horangireul joahaeyo', 'I like tigers.', '🐯'),
  horangireulJeil: ko('호랑이를 제일 좋아해요.', '호랑이를 제일 조아해요', 'horangireul jeil joahaeyo', 'I like tigers best.', '🐯'),
  pandagaJeilGwiyeowoyo: ko('판다가 제일 귀여워요.', '판다가 제일 귀여워요', 'pandaga jeil gwiyeowoyo', 'Pandas are the cutest.', '🐼'),
  annyeonghiGyeseyo: ko('안녕히 계세요.', '안녕히 계세요', 'annyeonghi gyeseyo', 'Goodbye (to someone staying).', '👋'),
  neJaemiisseosseoyo: ko('네, 재미있었어요!', '네 재미이써써요', 'ne jaemiisseosseoyo', 'Yes, it was fun!', '🎉'),
  jeongmalGamsahamnida: ko('정말 감사합니다.', '정말 감사함니다', 'jeongmal gamsahamnida', 'Thank you very much.', '🙏'),
  jeulgeowosseoyo: ko('네, 정말 즐거웠어요.', '네 정말 즐거워써요', 'ne jeongmal jeulgeowosseoyo', 'Yes, I really enjoyed it.', '😄'),
  neGamsahamnida: ko('네, 감사합니다.', '네 감사함니다', 'ne gamsahamnida', 'Yes, thank you.', '🙏'),

  // A new friend
  bangawoyo: ko('반가워요!', '반가워요', 'bangawoyo', 'Nice to meet you!', '😊'),
  mannaseoBangawoyo: ko('만나서 반가워요.', '만나서 반가워요', 'mannaseo bangawoyo', 'Nice to meet you.', '😊'),
  minjunBangawoyo: ko('안녕하세요, 민준! 반가워요.', '안녕하세요 민준 반가워요', 'annyeonghaseyo minjun bangawoyo', 'Hi, Minjun! Nice to meet you.', '👋'),
  cheoeumBwayo: ko('네, 처음 봐요. 반가워요.', '네 처음 봐요 반가워요', 'ne cheoeum bwayo bangawoyo', 'Yes, we haven’t met. Nice to meet you.', '🙂'),
  neMannaseo: ko('네, 만나서 반가워요.', '네 만나서 반가워요', 'ne mannaseo bangawoyo', 'Yes, nice to meet you.', '😊'),
  jeodoyo: ko('저도요!', '저도요', 'jeodoyo', 'Me too!', '🙌'),
  paransaek: ko('저는 파란색을 좋아해요.', '저는 파란새글 조아해요', 'jeoneun paransaegeul joahaeyo', 'I like blue.', '🔵'),
  paransaekJeil: ko('저는 파란색을 제일 좋아해요.', '저는 파란새글 제일 조아해요', 'jeoneun paransaegeul jeil joahaeyo', 'I like blue best.', '🔵'),
  jeodoPpalgansaek: ko('저도 빨간색을 좋아해요.', '저도 빨간새글 조아해요', 'jeodo ppalgansaegeul joahaeyo', 'I like red too.', '🔴'),
  jeodoChukgu: ko('저도 축구를 좋아해요.', '저도 축꾸를 조아해요', 'jeodo chukgureul joahaeyo', 'I like football too.', '⚽'),
  geurim: ko('저는 그림 그리는 걸 좋아해요.', '저는 그림 그리는 걸 조아해요', 'jeoneun geurim geurineun geol joahaeyo', 'I like drawing.', '🎨'),
  neGachiNorayo: ko('네, 같이 놀아요!', '네 가치 노라요', 'ne gachi norayo', 'Yes, let’s play together!', '🤸'),
  joayo: ko('좋아요!', '조아요', 'joayo', 'Great!', '🎉'),
  neJoayo: ko('네, 좋아요!', '네 조아요', 'ne joayo', 'Yes, great!', '🎉'),
  neGachiHaeyo: ko('네, 같이 해요!', '네 가치 해요', 'ne gachi haeyo', 'Yes, let’s play!', '⚽'),
  joayoGachiHalgeyo: ko('좋아요, 같이 할게요.', '조아요 가치 할께요', 'joayo gachi halgeyo', 'Sure, I’ll join you.', '😊'),
};

const BYE = {
  jalGayo: ko('잘 가요! 또 와요!', '잘 가요 또 와요', 'jal gayo tto wayo', 'Bye! Come again!'),
  ttoOseyo: ko('안녕히 가세요! 또 오세요!', '안녕히 가세요 또 오세요', 'annyeonghi gaseyo tto oseyo', 'Goodbye! Come again!'),
  gasipsio: ko('감사합니다. 안녕히 가십시오.', '감사함니다 안녕히 가십씨오', 'gamsahamnida annyeonghi gasipsio', 'Thank you. Goodbye.'),
  ttoWayo: ko('또 와요! 안녕!', '또 와요 안녕', 'tto wayo annyeong', 'Come again! Bye!'),
  gomawoyo: ko('와 줘서 고마워요. 안녕히 가세요!', '와 줘서 고마워요 안녕히 가세요', 'wa jwoseo gomawoyo annyeonghi gaseyo', 'Thanks for coming. Goodbye!'),
  bangmun: ko('방문해 주셔서 감사합니다. 안녕히 가십시오.', '방문해 주셔서 감사함니다 안녕히 가십씨오', 'bangmunhae jusyeoseo gamsahamnida annyeonghi gasipsio', 'Thank you for visiting. Goodbye.'),
  jaemiisseosseoyoAnnyeong: ko('재미있었어요! 안녕!', '재미이써써요 안녕', 'jaemiisseosseoyo annyeong', 'That was fun! Bye!'),
  naeilTtoBwayo: ko('재미있었어요! 내일 또 봐요!', '재미이써써요 내일 또 봐요', 'jaemiisseosseoyo naeil tto bwayo', 'That was fun! See you tomorrow!'),
  daeumeTtoBwayo: ko('재미있었어요. 다음에 또 봐요!', '재미이써써요 다으메 또 봐요', 'jaemiisseosseoyo daeume tto bwayo', 'That was fun. See you next time!'),
};

export const KO_SCENARIOS: Scenario[] = [
  {
    id: 'ko-cafe', course: 'ko', title: 'The Tteokbokki Shop', icon: '🍢', color: 'var(--coral)',
    blurb: { little: 'Order tteokbokki in Korean!', junior: 'Order a drink and a snack in Korean.', teen: 'Order, eat and thank the staff in Korean.' },
    setting: 'A small snack shop (분식집) in Seoul. The learner is a customer ordering food and drink, in Korean.',
    tutorRole: 'a friendly Korean snack-shop worker',
    goals: ['greet', 'order a drink', 'order food', 'say thank you'],
    turns: [
      {
        tutor: { little: T.baegopayo, junior: T.eoseoOseyo, teen: T.jumun },
        replies: { little: [R.neBaegopayo, R.annyeonghaseyo], junior: [R.neBaegopayo, R.jogeumBaegopayo], teen: [R.jumunhalgeyo, R.menyu] },
      },
      {
        tutor: { little: T.masillaeyo, junior: T.uyuJuseu, teen: T.eumnyo },
        replies: { little: [R.uyuJuseyo, R.mulJuseyo], junior: [R.juseuJuseyo, R.mulHanJan], teen: [R.keopiHanJan, R.mulHanJan] },
      },
      {
        tutor: { little: T.meogeullaeyo, junior: T.tteokbokkiMeogeullaeyo, teen: T.siksa },
        replies: { little: [R.tteokbokkiJuseyo, R.ppangJuseyo], junior: [R.neTteokbokki, R.gimbapJuseyo], teen: [R.tteokbokkihagoGimbap, R.ramyeonJuseyo] },
      },
      {
        tutor: { little: T.masitgeMeogeoyo, junior: T.masitgeDeuseyo, teen: T.masitgeDeusipsio },
        replies: { little: [R.gamsahamnida], junior: [R.gamsahamnida, R.jalMeokgetseumnida], teen: [R.gamsahamnidaJalMeokgetseumnida, R.jeongmalMasisseoyo] },
      },
    ],
    closing: { little: BYE.jalGayo, junior: BYE.ttoOseyo, teen: BYE.gasipsio },
  },
  {
    id: 'ko-zoo', course: 'ko', title: 'The Seoul Zoo', icon: '🐯', color: 'var(--leaf)',
    blurb: { little: 'Say hello to the tigers in Korean!', junior: 'Talk about the animals you see, in Korean.', teen: 'Plan your visit with a guide, in Korean.' },
    setting: 'The zoo in Seoul. The learner is a visitor talking to a guide about the animals, in Korean.',
    tutorRole: 'a friendly zoo guide',
    goals: ['greet', 'name animals', 'say what you like', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.dongmulJoahaeyo, junior: T.hwanyeong, teen: T.cheoeum },
        replies: { little: [R.neJoahaeyo, R.annyeonghaseyo], junior: [R.dongmureulJoahaeyo, R.jeongmalJoahaeyo], teen: [R.cheoeumieyo, R.duBeonjjae] },
      },
      {
        tutor: { little: T.mwoyeyo, junior: T.mwogaBoyeoyo, teen: T.mwobuteo },
        replies: { little: [R.horangi, R.panda], junior: [R.horangigaBoyeoyo, R.pandagaBoyeoyo], teen: [R.horangibuteo, R.pandabuteo] },
      },
      {
        tutor: { little: T.gwiyeopjyo, junior: T.museunDongmul, teen: T.eotteonDongmul },
        replies: { little: [R.neGwiyeowoyo, R.neomuGwiyeowoyo], junior: [R.pandareulJeil, R.horangireulJoahaeyo], teen: [R.horangireulJeil, R.pandagaJeilGwiyeowoyo] },
      },
      {
        tutor: { little: T.galSigan, junior: T.jaemiisseosseoyo, teen: T.jeulgeousyeotseumnikka },
        replies: { little: [R.annyeonghiGyeseyo, R.gamsahamnida], junior: [R.neJaemiisseosseoyo, R.jeongmalGamsahamnida], teen: [R.jeulgeowosseoyo, R.neGamsahamnida] },
      },
    ],
    closing: { little: BYE.ttoWayo, junior: BYE.gomawoyo, teen: BYE.bangmun },
  },
  {
    id: 'ko-friend', course: 'ko', title: 'A New Friend', icon: '🎈', color: 'var(--sky)',
    blurb: { little: 'Say hi and play, in Korean!', junior: 'Meet a new friend at the park, in Korean.', teen: 'Make small talk with someone new, in Korean.' },
    setting: 'A park. The learner meets a friendly child called 민준 (Minjun) and talks about favourite things, in Korean (never real personal details).',
    tutorRole: 'Minjun (민준), a friendly kid at the park',
    goals: ['greet', 'talk about favourite things', 'suggest playing', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.minjun, junior: T.minjunBangawoyo, teen: T.cheoeumBojyo },
        replies: { little: [R.annyeonghaseyo, R.bangawoyo], junior: [R.mannaseoBangawoyo, R.minjunBangawoyo], teen: [R.cheoeumBwayo, R.neMannaseo] },
      },
      {
        tutor: { little: T.ppalgansaek, junior: T.museunSaek, teen: T.chukgu },
        replies: { little: [R.jeodoyo, R.paransaek], junior: [R.paransaekJeil, R.jeodoPpalgansaek], teen: [R.jeodoChukgu, R.geurim] },
      },
      {
        tutor: { little: T.gachiNorayo, junior: T.gachiNollaeyo, teen: T.gachiHallaeyo },
        replies: { little: [R.neGachiNorayo, R.joayo], junior: [R.neJoayo, R.neGachiNorayo], teen: [R.neGachiHaeyo, R.joayoGachiHalgeyo] },
      },
    ],
    closing: { little: BYE.jaemiisseosseoyoAnnyeong, junior: BYE.naeilTtoBwayo, teen: BYE.daeumeTtoBwayo },
  },
];

/** Every line a learner may say in a Korean conversation — each one hangul with its pronounced form, for the tests. */
export const KO_SCENARIO_REPLIES = Object.values(R);
