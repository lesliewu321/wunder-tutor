/** Original Cantonese curriculum extension. Columns: spoken text | Jyutping | en | Hant | ja | ko | fr | es. */
const rows = text => text.trim().split('\n').map(line => line.split('|').map(cell => cell.trim()));
export const extension = [
{
 id:'family',icon:'🏠',names:['Family and belonging','家人與關係','家族と関係','가족과 관계','Famille et liens','Familia y relaciones'],
 tip:['Use 嘅 to show belonging: 我嘅 means my. 我哋 means we.','用「嘅」表示所屬：「我嘅」就是我的。「我哋」就是我們。','嘅は所有を表します。我嘅は「私の」、我哋は「私たち」です。','嘅는 소유를 나타냅니다. 我嘅는 나의, 我哋는 우리입니다.','嘅 marque la possession : 我嘅 signifie mon ou ma, et 我哋 signifie nous.','嘅 indica posesión: 我嘅 significa mi, y 我哋 significa nosotros.'],
 rows:rows(`媽媽|maa4 maa1|mother|媽媽|母|어머니|mère|madre
爸爸|baa4 baa1|father|爸爸|父|아버지|père|padre
家姐|gaa1 ze1|older sister|姐姐|姉|누나 또는 언니|grande sœur|hermana mayor
細佬|sai3 lou2|younger brother|弟弟|弟|남동생|petit frère|hermano menor
佢係我家姐。|keoi5 hai6 ngo5 gaa1 ze1|She is my older sister.|她是我姐姐。|彼女は私の姉です。|그 사람은 제 누나 또는 언니예요.|C’est ma grande sœur.|Es mi hermana mayor.
我哋係一家人。|ngo5 dei6 hai6 jat1 gaa1 jan4|We are a family.|我們是一家人。|私たちは家族です。|우리는 한 가족이에요.|Nous sommes une famille.|Somos una familia.
佢係邊個？|keoi5 hai6 bin1 go3|Who is that person?|那個人是誰？|あの人は誰ですか。|그 사람은 누구예요?|Qui est cette personne ?|¿Quién es esa persona?
呢本係我嘅書。|ni1 bun2 hai6 ngo5 ge3 syu1|This is my book.|這本是我的書。|これは私の本です。|이것은 제 책이에요.|C’est mon livre.|Este es mi libro.
呢本係邊個嘅書？|ni1 bun2 hai6 bin1 go3 ge3 syu1|Whose book is this?|這本是誰的書？|これは誰の本ですか。|이것은 누구의 책이에요?|À qui est ce livre ?|¿De quién es este libro?
我有一個細佬。|ngo5 jau5 jat1 go3 sai3 lou2|I have a younger brother.|我有一個弟弟。|弟が一人います。|남동생이 한 명 있어요.|J’ai un petit frère.|Tengo un hermano menor.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['佢','係','我家姐。'],5:['我哋','係','一家人。']}
},
{
 id:'home',icon:'🛋️',names:['At home and where things are','屋企與物件位置','家と物の場所','집과 물건의 위치','À la maison et les objets','En casa y dónde están las cosas'],
 tip:['喺 tells where something is. 有冇 asks whether something is there.','「喺」表示位置；「有冇」用來問有沒有。','喺は場所を表し、有冇は物があるかを尋ねます。','喺는 위치를 나타내고 有冇는 있는지 묻습니다.','喺 indique un emplacement. 有冇 demande si quelque chose est présent.','喺 indica dónde está algo. 有冇 pregunta si hay algo.'],
 rows:rows(`屋企|uk1 kei2|home|家|家|집|chez soi|hogar
房|fong2|room|房間|部屋|방|pièce|habitación
枱|toi2|table|桌子|テーブル|탁자|table|mesa
凳|dang3|chair|椅子|椅子|의자|chaise|silla
本書喺枱面。|bun2 syu1 hai2 toi2 min6|The book is on the table.|書在桌上。|本はテーブルの上にあります。|책이 탁자 위에 있어요.|Le livre est sur la table.|El libro está en la mesa.
我喺屋企。|ngo5 hai2 uk1 kei2|I am at home.|我在家。|家にいます。|저는 집에 있어요.|Je suis à la maison.|Estoy en casa.
本書喺邊？|bun2 syu1 hai2 bin1|Where is the book?|書在哪裏？|本はどこですか。|책이 어디에 있어요?|Où est le livre ?|¿Dónde está el libro?
呢度有張凳。|ni1 dou6 jau5 zoeng1 dang3|There is a chair here.|這裏有一張椅子。|ここに椅子があります。|여기에 의자가 있어요.|Il y a une chaise ici.|Aquí hay una silla.
呢度有冇凳？|ni1 dou6 jau5 mou5 dang3|Is there a chair here?|這裏有椅子嗎？|ここに椅子はありますか。|여기에 의자가 있나요?|Y a-t-il une chaise ici ?|¿Hay una silla aquí?
閂門，唔該。|saan1 mun4 m4 goi1|Please close the door.|請關門。|ドアを閉めてください。|문을 닫아 주세요.|Fermez la porte, s’il vous plaît.|Cierra la puerta, por favor.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['本書','喺','枱面。'],5:['我','喺','屋企。']}
},
{
 id:'school',icon:'🎒',names:['Learning and asking for help','學習與請教','学習と質問','학습과 도움 요청','Apprendre et demander de l’aide','Aprender y pedir ayuda'],
 tip:['聽唔明 means not understanding what you hear. Use 再 to ask for another try.','「聽唔明」表示聽不懂；「再」表示再做一次。','聽唔明は「聞いても分からない」、再は「もう一度」を表します。','聽唔明는 들어도 이해하지 못한다는 뜻이며 再는 다시를 뜻합니다.','聽唔明 signifie ne pas comprendre à l’écoute. 再 signifie encore une fois.','聽唔明 significa no entender lo que oyes. 再 significa otra vez.'],
 rows:rows(`老師|lou5 si1|teacher|老師|先生|선생님|professeur|docente
同學|tung4 hok6|classmate|同學|クラスメート|반 친구|camarade de classe|compañero de clase
功課|gung1 fo3|homework|功課|宿題|숙제|devoirs|deberes
問題|man6 tai4|question|問題|質問|질문|question|pregunta
我聽唔明。|ngo5 teng1 m4 ming4|I do not understand what I hear.|我聽不懂。|聞いても分かりません。|무슨 말인지 이해하지 못하겠어요.|Je ne comprends pas ce que j’entends.|No entiendo lo que oigo.
唔該，再講一次。|m4 goi1 zoi3 gong2 jat1 ci3|Please say it one more time.|請再說一次。|もう一度言ってください。|한 번 더 말해 주세요.|Répétez encore une fois, s’il vous plaît.|Repítelo una vez más, por favor.
你明唔明？|nei5 ming4 m4 ming4|Do you understand?|你明白嗎？|分かりますか。|이해하겠어요?|Est-ce que tu comprends ?|¿Lo entiendes?
我明喇。|ngo5 ming4 laa3|I understand now.|我明白了。|今は分かりました。|이제 이해했어요.|Je comprends maintenant.|Ahora lo entiendo.
你想問咩？|nei5 soeng2 man6 me1|What would you like to ask?|你想問甚麼？|何を聞きたいですか。|무엇을 묻고 싶어요?|Que voudrais-tu demander ?|¿Qué te gustaría preguntar?
呢個字點讀？|ni1 go3 zi6 dim2 duk6|How do you pronounce this character?|這個字怎樣讀？|この字はどう読みますか。|이 글자는 어떻게 읽어요?|Comment prononce-t-on ce caractère ?|¿Cómo se pronuncia este carácter?`),
 turns:[[6,[4,7]],[8,[9]]],chunks:{4:['我','聽唔明。'],5:['唔該，','再講','一次。']}
},
{
 id:'animals',icon:'🐈',names:['Animals and classifiers','動物與量詞','動物と助数詞','동물과 수량 표현','Animaux et classificateurs','Animales y clasificadores'],
 tip:['Use 隻 for these animals. 呢隻 means this one; 嗰隻 means that one.','這些動物用量詞「隻」；「呢隻」是這一隻，「嗰隻」是那一隻。','ここでは動物を隻で数えます。呢隻は「この一匹」、嗰隻は「あの一匹」です。','이 동물들은 隻로 셉니다. 呢隻는 이 동물, 嗰隻는 저 동물을 가리킵니다.','隻 sert à compter ces animaux. 呢隻 désigne celui-ci et 嗰隻 celui-là.','隻 se usa para contar estos animales. 呢隻 es este y 嗰隻 es aquel.'],
 rows:rows(`貓|maau1|cat|貓|猫|고양이|chat|gato
狗|gau2|dog|狗|犬|개|chien|perro
雀仔|zoek3 zai2|bird|小鳥|鳥|새|oiseau|pájaro
兔仔|tou3 zai2|rabbit|兔子|ウサギ|토끼|lapin|conejo
呢隻貓好細。|ni1 zek3 maau1 hou2 sai3|This cat is very small.|這隻貓很小。|この猫はとても小さいです。|이 고양이는 아주 작아요.|Ce chat est tout petit.|Este gato es muy pequeño.
嗰隻狗好大。|go2 zek3 gau2 hou2 daai6|That dog is very big.|那隻狗很大。|あの犬はとても大きいです。|저 개는 아주 커요.|Ce chien-là est très grand.|Aquel perro es muy grande.
邊隻貓好細？|bin1 zek3 maau1 hou2 sai3|Which cat is very small?|哪隻貓很小？|どの猫がとても小さいですか。|어느 고양이가 아주 작아요?|Quel chat est tout petit ?|¿Qué gato es muy pequeño?
我鍾意兔仔。|ngo5 zung1 ji3 tou3 zai2|I like rabbits.|我喜歡兔子。|ウサギが好きです。|저는 토끼를 좋아해요.|J’aime les lapins.|Me gustan los conejos.
你鍾意咩動物？|nei5 zung1 ji3 me1 dung6 mat6|What animals do you like?|你喜歡甚麼動物？|どんな動物が好きですか。|어떤 동물을 좋아해요?|Quels animaux aimes-tu ?|¿Qué animales te gustan?
有兩隻雀仔。|jau5 loeng5 zek3 zoek3 zai2|There are two birds.|有兩隻小鳥。|鳥が二羽います。|새 두 마리가 있어요.|Il y a deux oiseaux.|Hay dos pájaros.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['呢隻貓','好細。'],5:['嗰隻狗','好大。']}
},
{
 id:'weather',icon:'🌦️',names:['Weather and getting ready','天氣與準備','天気と準備','날씨와 준비','Météo et préparatifs','El tiempo y los preparativos'],
 tip:['Put the time word first: 今日 means today and 聽日 means tomorrow.','時間詞可以放句首：「今日」是今天，「聽日」是明天。','今日は「今日」、聽日は「明日」です。時間を表す語を文頭に置けます。','今日는 오늘, 聽日는 내일입니다. 시간을 나타내는 말을 문장 앞에 놓을 수 있습니다.','Placez le moment au début : 今日 signifie aujourd’hui et 聽日 demain.','Puedes empezar por el tiempo: 今日 es hoy y 聽日 es mañana.'],
 rows:rows(`落雨|lok6 jyu5|raining|下雨|雨が降る|비가 오다|pleuvoir|llover
熱|jit6|hot|熱|暑い|덥다|chaud|calor
凍|dung3|cold|冷|寒い|춥다|froid|frío
遮|ze1|umbrella|雨傘|傘|우산|parapluie|paraguas
今日好熱。|gam1 jat6 hou2 jit6|It is very hot today.|今天很熱。|今日はとても暑いです。|오늘은 아주 더워요.|Il fait très chaud aujourd’hui.|Hoy hace mucho calor.
記得帶遮。|gei3 dak1 daai3 ze1|Remember to bring an umbrella.|記得帶雨傘。|傘を持っていくのを忘れないで。|우산 챙기는 것을 잊지 마세요.|Pense à prendre un parapluie.|Recuerda llevar un paraguas.
今日天氣點呀？|gam1 jat6 tin1 hei3 dim2 aa3|What is the weather like today?|今天天氣怎樣？|今日の天気はどうですか。|오늘 날씨는 어때요?|Quel temps fait-il aujourd’hui ?|¿Qué tiempo hace hoy?
出面落緊雨。|ceot1 min6 lok6 gan2 jyu5|It is raining outside.|外面正在下雨。|外は雨が降っています。|밖에 비가 오고 있어요.|Il pleut dehors.|Está lloviendo fuera.
出面有冇落雨？|ceot1 min6 jau5 mou5 lok6 jyu5|Is it raining outside?|外面在下雨嗎？|外は雨が降っていますか。|밖에 비가 오나요?|Est-ce qu’il pleut dehors ?|¿Está lloviendo fuera?
聽日可能落雨。|ting1 jat6 ho2 nang4 lok6 jyu5|It may rain tomorrow.|明天可能下雨。|明日は雨が降るかもしれません。|내일 비가 올 수도 있어요.|Il pleuvra peut-être demain.|Puede que llueva mañana.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['今日','好熱。'],5:['記得','帶遮。']}
},
{
 id:'feelings',icon:'🙂',names:['Feelings and needs','感受與需要','気持ちと必要なこと','감정과 필요한 것','Émotions et besoins','Emociones y necesidades'],
 tip:['想 expresses what you would like to do. 唔想 makes it negative.','「想」表示想做的事；「唔想」表示不想。','想は「したい」、唔想は「したくない」を表します。','想은 하고 싶다, 唔想은 하고 싶지 않다는 뜻입니다.','想 exprime une envie de faire quelque chose ; 唔想 en est la négation.','想 expresa lo que quieres hacer; 唔想 expresa lo que no quieres hacer.'],
 rows:rows(`攰|gui6|tired|疲倦|疲れた|피곤하다|fatigué|cansado
肚餓|tou5 ngo6|hungry|肚子餓|おなかがすいた|배고프다|avoir faim|tener hambre
口渴|hau2 hot3|thirsty|口渴|喉が渇いた|목마르다|avoir soif|tener sed
擔心|daam1 sam1|worried|擔心|心配だ|걱정되다|inquiet|preocupado
我有啲攰。|ngo5 jau5 di1 gui6|I am a little tired.|我有點累。|少し疲れています。|조금 피곤해요.|Je suis un peu fatigué.|Estoy un poco cansado.
我想休息吓。|ngo5 soeng2 jau1 sik1 haa5|I would like to rest for a while.|我想休息一下。|少し休みたいです。|잠깐 쉬고 싶어요.|J’aimerais me reposer un peu.|Quiero descansar un rato.
你攰唔攰？|nei5 gui6 m4 gui6|Are you tired?|你累嗎？|疲れていますか。|피곤해요?|Est-ce que tu es fatigué ?|¿Estás cansado?
我想飲水。|ngo5 soeng2 jam2 seoi2|I would like to drink water.|我想喝水。|水を飲みたいです。|물을 마시고 싶어요.|Je voudrais boire de l’eau.|Quiero beber agua.
你想飲啲咩？|nei5 soeng2 jam2 di1 me1|What would you like to drink?|你想喝甚麼？|何を飲みたいですか。|무엇을 마시고 싶어요?|Que voudrais-tu boire ?|¿Qué te gustaría beber?
我而家唔想玩。|ngo5 ji4 gaa1 m4 soeng2 waan2|I do not want to play right now.|我現在不想玩。|今は遊びたくありません。|지금은 놀고 싶지 않아요.|Je n’ai pas envie de jouer maintenant.|Ahora no quiero jugar.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['我','有啲','攰。'],5:['我','想','休息吓。']}
},
{
 id:'routines',icon:'⏰',names:['Daily routines and actions','日常生活與動作','毎日の生活と動作','일과와 동작','Habitudes et actions','Rutinas y acciones'],
 tip:['Add 緊 after a verb for an action happening now: 食緊 means eating.','動詞後加「緊」表示正在做：「食緊」就是正在吃。','動詞の後の緊は進行中を表します。食緊は「食べている」です。','동사 뒤의 緊은 진행 중인 행동을 나타냅니다. 食緊은 먹고 있다는 뜻입니다.','緊 après le verbe marque une action en cours : 食緊 signifie être en train de manger.','緊 después del verbo indica una acción en curso: 食緊 significa estar comiendo.'],
 rows:rows(`起身|hei2 san1|get up|起床|起きる|일어나다|se lever|levantarse
刷牙|caat3 ngaa4|brush your teeth|刷牙|歯を磨く|이를 닦다|se brosser les dents|cepillarse los dientes
食飯|sik6 faan6|have a meal|吃飯|ご飯を食べる|밥을 먹다|prendre un repas|comer
瞓覺|fan3 gaau3|sleep|睡覺|寝る|잠자다|dormir|dormir
我七點起身。|ngo5 cat1 dim2 hei2 san1|I get up at seven.|我七點起床。|七時に起きます。|일곱 시에 일어나요.|Je me lève à sept heures.|Me levanto a las siete.
我食緊飯。|ngo5 sik6 gan2 faan6|I am having a meal.|我正在吃飯。|今ご飯を食べています。|지금 밥을 먹고 있어요.|Je suis en train de manger.|Estoy comiendo.
你幾點起身？|nei5 gei2 dim2 hei2 san1|What time do you get up?|你幾點起床？|何時に起きますか。|몇 시에 일어나요?|À quelle heure te lèves-tu ?|¿A qué hora te levantas?
我做緊功課。|ngo5 zou6 gan2 gung1 fo3|I am doing homework.|我正在做功課。|宿題をしています。|숙제를 하고 있어요.|Je fais mes devoirs.|Estoy haciendo los deberes.
你做緊咩？|nei5 zou6 gan2 me1|What are you doing?|你正在做甚麼？|何をしていますか。|무엇을 하고 있어요?|Qu’est-ce que tu fais ?|¿Qué estás haciendo?
食完飯先刷牙。|sik6 jyun4 faan6 sin1 caat3 ngaa4|Brush your teeth after the meal.|吃完飯才刷牙。|食事が終わってから歯を磨きます。|식사를 마친 다음 이를 닦아요.|Brosse-toi les dents après le repas.|Cepíllate los dientes después de comer.`),
 turns:[[6,[4]],[8,[5,7]]],chunks:{4:['我','七點','起身。'],5:['我','食緊','飯。']}
},
{
 id:'hobbies',icon:'🎨',names:['Hobbies and abilities','興趣與能力','趣味とできること','취미와 능력','Loisirs et capacités','Aficiones y habilidades'],
 tip:['識 describes a learned ability. 識唔識 asks if someone knows how.','「識」表示懂得做；「識唔識」用來問懂不懂。','識は身につけた能力を表し、識唔識は「できますか」と尋ねます。','識은 배워서 할 줄 안다는 뜻이며 識唔識는 할 줄 아는지 묻습니다.','識 exprime un savoir-faire acquis. 識唔識 demande si on sait faire.','識 expresa una habilidad aprendida. 識唔識 pregunta si se sabe hacer algo.'],
 rows:rows(`游水|jau4 seoi2|swim|游泳|泳ぐ|수영하다|nager|nadar
畫畫|waak6 waa2|draw pictures|畫畫|絵を描く|그림을 그리다|dessiner|dibujar
唱歌|coeng3 go1|sing|唱歌|歌う|노래하다|chanter|cantar
睇書|tai2 syu1|read a book|看書|本を読む|책을 읽다|lire un livre|leer un libro
我識游水。|ngo5 sik1 jau4 seoi2|I know how to swim.|我會游泳。|泳げます。|수영할 줄 알아요.|Je sais nager.|Sé nadar.
我唔識游水。|ngo5 m4 sik1 jau4 seoi2|I do not know how to swim.|我不會游泳。|泳げません。|수영할 줄 몰라요.|Je ne sais pas nager.|No sé nadar.
你識唔識游水？|nei5 sik1 m4 sik1 jau4 seoi2|Do you know how to swim?|你會游泳嗎？|泳げますか。|수영할 줄 알아요?|Sais-tu nager ?|¿Sabes nadar?
我鍾意畫畫。|ngo5 zung1 ji3 waak6 waa2|I like drawing.|我喜歡畫畫。|絵を描くのが好きです。|그림 그리기를 좋아해요.|J’aime dessiner.|Me gusta dibujar.
你得閒鍾意做咩？|nei5 dak1 haan4 zung1 ji3 zou6 me1|What do you like doing in your free time?|你空閒時喜歡做甚麼？|暇なとき何をするのが好きですか。|시간이 날 때 무엇을 좋아해요?|Qu’aimes-tu faire pendant ton temps libre ?|¿Qué te gusta hacer en tu tiempo libre?
我每個星期都睇書。|ngo5 mui5 go3 sing1 kei4 dou1 tai2 syu1|I read every week.|我每星期都看書。|毎週本を読みます。|매주 책을 읽어요.|Je lis chaque semaine.|Leo todas las semanas.`),
 turns:[[6,[4,5]],[8,[7,9]]],chunks:{4:['我','識','游水。'],5:['我','唔識','游水。']}
},
];
