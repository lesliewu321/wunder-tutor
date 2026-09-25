/** Original everyday and applied Cantonese. Columns: Cantonese | Jyutping | en | Hant | ja | ko | fr | es. */
const rows = text => text.trim().split('\n').map(line => line.split('|').map(cell => cell.trim()));
export const applications = [
{
 id:'dining',icon:'🥢',names:['Ordering and preferences','點餐與口味','注文と好み','주문과 취향','Commander et préciser ses goûts','Pedir comida y expresar preferencias'],
 tip:['少啲 asks for less. 唔要 means do not include it. Confirm a special request clearly.','「少啲」表示少一點；「唔要」表示不要加。特別要求要說清楚。','少啲は「少なめに」、唔要は「入れないで」です。特別な注文は明確に確認しましょう。','少啲는 적게, 唔要는 넣지 말라는 뜻입니다. 특별 요청은 분명히 확인하세요.','少啲 demande moins ; 唔要 demande de ne pas ajouter. Confirmez clairement une demande particulière.','少啲 pide menos; 唔要 pide no añadirlo. Confirma claramente cualquier petición especial.'],
 rows:rows(`餐牌|caan1 paai4|menu|餐牌|メニュー|메뉴|carte du restaurant|menú
筷子|faai3 zi2|chopsticks|筷子|箸|젓가락|baguettes|palillos
湯|tong1|soup|湯|スープ|국|soupe|sopa
花生|faa1 sang1|peanuts|花生|ピーナッツ|땅콩|cacahuètes|cacahuetes
唔該，少啲糖。|m4 goi1 siu2 di1 tong4|Less sugar, please.|請少放一點糖。|砂糖を少なめにしてください。|설탕을 적게 넣어 주세요.|Moins de sucre, s’il vous plaît.|Menos azúcar, por favor.
我唔食花生。|ngo5 m4 sik6 faa1 sang1|I do not eat peanuts.|我不吃花生。|ピーナッツは食べません。|땅콩을 먹지 않아요.|Je ne mange pas de cacahuètes.|No como cacahuetes.
你要幾多糖？|nei5 jiu3 gei2 do1 tong4|How much sugar would you like?|你要多少糖？|砂糖はどのくらい入れますか。|설탕을 얼마나 넣어 드릴까요?|Combien de sucre voulez-vous ?|¿Cuánto azúcar quieres?
呢個有花生。|ni1 go3 jau5 faa1 sang1|This contains peanuts.|這個含有花生。|これはピーナッツ入りです。|이것에는 땅콩이 들어 있어요.|Ceci contient des cacahuètes.|Esto lleva cacahuetes.
呢個有冇花生？|ni1 go3 jau5 mou5 faa1 sang1|Does this contain peanuts?|這個含有花生嗎？|これはピーナッツ入りですか。|이것에 땅콩이 들어 있나요?|Ceci contient-il des cacahuètes ?|¿Esto lleva cacahuetes?
唔該，埋單。|m4 goi1 maai4 daan1|The bill, please.|請結帳。|お会計をお願いします。|계산해 주세요.|L’addition, s’il vous plaît.|La cuenta, por favor.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['唔該，','少啲','糖。'],5:['我','唔食','花生。']}
},
{
 id:'health',icon:'🩺',names:['Feeling unwell and asking for help','身體不適與求助','体調と助けを求めること','몸 상태와 도움 요청','Se sentir malade et demander de l’aide','Malestar y pedir ayuda'],
 tip:['Use 唔舒服 to say you feel unwell and 邊度 to ask where. Practise telling a trusted adult.','用「唔舒服」表示不適，「邊度」表示哪裏。練習向可信任的成人求助。','唔舒服は「具合が悪い」、邊度は「どこ」です。信頼できる大人に伝える練習をしましょう。','唔舒服는 몸이 안 좋다, 邊度는 어디라는 뜻입니다. 믿을 수 있는 어른에게 말하는 연습을 하세요.','唔舒服 indique un malaise et 邊度 signifie où. Entraînez-vous à prévenir un adulte de confiance.','唔舒服 expresa malestar y 邊度 significa dónde. Practica avisar a un adulto de confianza.'],
 rows:rows(`頭|tau4|head|頭|頭|머리|tête|cabeza
肚|tou5|belly|肚子|おなか|배|ventre|barriga
手|sau2|hand|手|手|손|main|mano
醫生|ji1 sang1|doctor|醫生|医師|의사|médecin|médico
我個頭好痛。|ngo5 go3 tau4 hou2 tung3|My head hurts a lot.|我的頭很痛。|頭がとても痛いです。|머리가 많이 아파요.|J’ai très mal à la tête.|Me duele mucho la cabeza.
我唔舒服。|ngo5 m4 syu1 fuk6|I feel unwell.|我不舒服。|具合が悪いです。|몸이 안 좋아요.|Je ne me sens pas bien.|Me encuentro mal.
你邊度痛？|nei5 bin1 dou6 tung3|Where does it hurt?|你哪裏痛？|どこが痛いですか。|어디가 아파요?|Où as-tu mal ?|¿Dónde te duele?
我想搵醫生。|ngo5 soeng2 wan2 ji1 sang1|I would like to see a doctor.|我想找醫生。|医師に診てもらいたいです。|의사 선생님을 만나고 싶어요.|Je voudrais voir un médecin.|Quiero ver a un médico.
你想搵邊個？|nei5 soeng2 wan2 bin1 go3|Who would you like to see?|你想找誰？|誰に会いたいですか。|누구를 만나고 싶어요?|Qui voudrais-tu voir ?|¿A quién quieres ver?
唔該，幫我叫大人。|m4 goi1 bong1 ngo5 giu3 daai6 jan4|Please get an adult to help me.|請幫我找成人。|大人を呼んでください。|어른을 불러 주세요.|Appelez un adulte pour m’aider, s’il vous plaît.|Llama a un adulto para ayudarme, por favor.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['我個頭','好痛。'],5:['我','唔舒服。']}
},
{
 id:'services',icon:'📚',names:['Library and community services','圖書館與社區服務','図書館と地域のサービス','도서관과 지역 서비스','Bibliothèque et services locaux','Biblioteca y servicios locales'],
 tip:['借 means borrow; 還 means return. Use 可唔可以 for a polite permission question.','「借」和「還」意思相反；「可唔可以」可用來禮貌地問准許。','借は「借りる」、還は「返す」です。可唔可以で丁寧に許可を尋ねます。','借는 빌리다, 還은 돌려주다입니다. 可唔可以로 정중히 허락을 구하세요.','借 signifie emprunter et 還 rendre. 可唔可以 permet de demander poliment une autorisation.','借 significa tomar prestado y 還 devolver. 可唔可以 sirve para pedir permiso con cortesía.'],
 rows:rows(`圖書館|tou4 syu1 gun2|library|圖書館|図書館|도서관|bibliothèque|biblioteca
借書|ze3 syu1|borrow a book|借書|本を借りる|책을 빌리다|emprunter un livre|tomar un libro prestado
還書|waan4 syu1|return a book|還書|本を返す|책을 반납하다|rendre un livre|devolver un libro
排隊|paai4 deoi6|queue up|排隊|列に並ぶ|줄을 서다|faire la queue|hacer cola
我想借呢本書。|ngo5 soeng2 ze3 ni1 bun2 syu1|I would like to borrow this book.|我想借這本書。|この本を借りたいです。|이 책을 빌리고 싶어요.|Je voudrais emprunter ce livre.|Quiero tomar prestado este libro.
唔該，喺呢度排隊。|m4 goi1 hai2 ni1 dou6 paai4 deoi6|Please queue here.|請在這裏排隊。|ここに並んでください。|여기에 줄을 서 주세요.|Faites la queue ici, s’il vous plaît.|Haz cola aquí, por favor.
你想借邊本書？|nei5 soeng2 ze3 bin1 bun2 syu1|Which book would you like to borrow?|你想借哪本書？|どの本を借りたいですか。|어느 책을 빌리고 싶어요?|Quel livre voudrais-tu emprunter ?|¿Qué libro quieres tomar prestado?
可以，呢度有位。|ho2 ji5 ni1 dou6 jau5 wai2|Yes, there is a seat here.|可以，這裏有座位。|はい、ここに席があります。|네, 여기에 자리가 있어요.|Oui, il y a une place ici.|Sí, aquí hay sitio.
可唔可以坐呢度？|ho2 m4 ho2 ji5 co5 ni1 dou6|May I sit here?|我可以坐這裏嗎？|ここに座ってもいいですか。|여기에 앉아도 될까요?|Puis-je m’asseoir ici ?|¿Puedo sentarme aquí?
我聽日還書。|ngo5 ting1 jat6 waan4 syu1|I will return the book tomorrow.|我明天還書。|明日本を返します。|내일 책을 반납할게요.|Je rendrai le livre demain.|Devolveré el libro mañana.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['我','想借','呢本書。'],5:['唔該，','喺呢度','排隊。']}
},
{
 id:'digital',icon:'📱',names:['Messages and staying connected','訊息與聯絡','メッセージと連絡','메시지와 연락','Messages et communication','Mensajes y comunicación'],
 tip:['未 asks whether something has happened yet. 咗 marks a completed event; 未 means not yet in a reply.','「未」可問做了沒有；「咗」標記已發生的動作，回答「未」表示還沒。','未は「もう〜したか」を尋ねます。咗は完了、返答の未は「まだ」です。','未는 벌써 했는지 묻습니다. 咗는 완료, 대답의 未는 아직이라는 뜻입니다.','未 demande si une action a déjà eu lieu. 咗 marque son achèvement ; 未 en réponse signifie pas encore.','未 pregunta si algo ya ocurrió. 咗 marca una acción completada; 未 como respuesta significa todavía no.'],
 rows:rows(`電話|din6 waa2|telephone|電話|電話|전화|téléphone|teléfono
訊息|seon3 sik1|message|訊息|メッセージ|메시지|message|mensaje
相|soeng2|photograph|照片|写真|사진|photo|foto
上網|soeng5 mong5|go online|上網|インターネットを使う|인터넷에 접속하다|aller sur Internet|conectarse a internet
我收到訊息喇。|ngo5 sau1 dou2 seon3 sik1 laa3|I have received the message.|我收到訊息了。|メッセージを受け取りました。|메시지를 받았어요.|J’ai reçu le message.|He recibido el mensaje.
我仲未收到。|ngo5 zung6 mei6 sau1 dou2|I have not received it yet.|我還沒有收到。|まだ受け取っていません。|아직 받지 못했어요.|Je ne l’ai pas encore reçu.|Todavía no lo he recibido.
你收到訊息未？|nei5 sau1 dou2 seon3 sik1 mei6|Have you received the message yet?|你收到訊息了嗎？|メッセージはもう届きましたか。|메시지를 받았나요?|As-tu reçu le message ?|¿Has recibido el mensaje?
好，我再講一次。|hou2 ngo5 zoi3 gong2 jat1 ci3|Okay, I will say it again.|好，我再說一次。|はい、もう一度言います。|네, 다시 말할게요.|D’accord, je vais le redire.|Vale, lo diré otra vez.
唔該，可唔可以再講一次？|m4 goi1 ho2 m4 ho2 ji5 zoi3 gong2 jat1 ci3|Could you say it again, please?|請你再說一次，可以嗎？|もう一度言ってもらえますか。|한 번 더 말해 주실 수 있나요?|Pourriez-vous le répéter, s’il vous plaît ?|¿Puedes repetirlo, por favor?
我發咗張相畀你。|ngo5 faat3 zo2 zoeng1 soeng2 bei2 nei5|I sent you a photo.|我發了一張照片給你。|あなたに写真を送りました。|사진을 보냈어요.|Je t’ai envoyé une photo.|Te envié una foto.`),
 turns:[[6,[4,5]],[8,[7]]],chunks:{4:['我','收到','訊息喇。'],5:['我','仲未','收到。']}
},
{
 id:'travel',icon:'🧳',names:['Trips and accommodation','旅程與住宿','旅行と宿泊','여행과 숙소','Voyages et hébergement','Viajes y alojamiento'],
 tip:['Use 想去 for a destination and 住 for staying somewhere. Practise with pretend travel details.','用「想去」說目的地，用「住」說住宿；以虛構資料練習。','想去で目的地を、住で滞在を表します。架空の旅行で練習しましょう。','想去로 목적지, 住로 머무는 곳을 말합니다. 가상의 여행 정보로 연습하세요.','想去 présente une destination et 住 un séjour. Utilisez des détails de voyage imaginaires.','想去 introduce un destino y 住 una estancia. Practica con datos de viaje ficticios.'],
 rows:rows(`機場|gei1 coeng4|airport|機場|空港|공항|aéroport|aeropuerto
酒店|zau2 dim3|hotel|酒店|ホテル|호텔|hôtel|hotel
行李|hang4 lei5|luggage|行李|荷物|짐|bagages|equipaje
地圖|dei6 tou4|map|地圖|地図|지도|carte géographique|mapa
我想去機場。|ngo5 soeng2 heoi3 gei1 coeng4|I would like to go to the airport.|我想去機場。|空港に行きたいです。|공항에 가고 싶어요.|Je voudrais aller à l’aéroport.|Quiero ir al aeropuerto.
我哋住兩晚。|ngo5 dei6 zyu6 loeng5 maan5|We are staying for two nights.|我們住兩晚。|二泊します。|우리는 이틀 밤 머물러요.|Nous restons deux nuits.|Nos quedamos dos noches.
你哋住幾晚？|nei5 dei6 zyu6 gei2 maan5|How many nights are you staying?|你們住幾晚？|何泊しますか。|며칠 밤 머무르나요?|Combien de nuits restez-vous ?|¿Cuántas noches os quedáis?
早餐喺二樓。|zou2 caan1 hai2 ji6 lau2|Breakfast is on the second floor.|早餐在二樓。|朝食は二階です。|아침 식사는 이 층에서 해요.|Le petit-déjeuner est au deuxième étage.|El desayuno es en la segunda planta.
早餐喺邊度？|zou2 caan1 hai2 bin1 dou6|Where is breakfast served?|早餐在哪裏？|朝食はどこですか。|아침 식사는 어디서 하나요?|Où est servi le petit-déjeuner ?|¿Dónde se sirve el desayuno?
唔該，幫我睇吓地圖。|m4 goi1 bong1 ngo5 tai2 haa5 dei6 tou4|Please help me check the map.|請幫我看一下地圖。|地図を見るのを手伝ってください。|지도를 같이 봐 주세요.|Aidez-moi à regarder la carte, s’il vous plaît.|Ayúdame a mirar el mapa, por favor.`),
 turns:[[6,[5]],[8,[7]]],chunks:{4:['我','想去','機場。'],5:['我哋','住','兩晚。']}
},
{
 id:'plans',icon:'🗓️',names:['Invitations and making plans','邀請與安排','誘いと予定','초대와 계획','Invitations et projets','Invitaciones y planes'],
 tip:['好唔好 invites agreement. 得閒 means free or available; 冇時間 means having no time.','「好唔好」徵求同意；「得閒」是有空，「冇時間」是沒時間。','好唔好で賛成を求めます。得閒は「暇がある」、冇時間は「時間がない」です。','好唔好는 동의를 구합니다. 得閒는 시간이 있다, 冇時間은 시간이 없다는 뜻입니다.','好唔好 demande un accord. 得閒 signifie être disponible ; 冇時間 manquer de temps.','好唔好 busca acuerdo. 得閒 significa estar libre y 冇時間 no tener tiempo.'],
 rows:rows(`今日|gam1 jat6|today|今天|今日|오늘|aujourd’hui|hoy
聽日|ting1 jat6|tomorrow|明天|明日|내일|demain|mañana
星期六|sing1 kei4 luk6|Saturday|星期六|土曜日|토요일|samedi|sábado
得閒|dak1 haan4|available|有空|都合がよい|시간이 있다|disponible|disponible
我聽日得閒。|ngo5 ting1 jat6 dak1 haan4|I am free tomorrow.|我明天有空。|明日は空いています。|내일 시간이 있어요.|Je suis libre demain.|Estoy libre mañana.
對唔住，我冇時間。|deoi3 m4 zyu6 ngo5 mou5 si4 gaan3|Sorry, I do not have time.|對不起，我沒有時間。|すみません、時間がありません。|미안하지만 시간이 없어요.|Désolé, je n’ai pas le temps.|Lo siento, no tengo tiempo.
你聽日得唔得閒？|nei5 ting1 jat6 dak1 m4 dak1 haan4|Are you free tomorrow?|你明天有空嗎？|明日は空いていますか。|내일 시간 있어요?|Es-tu libre demain ?|¿Estás libre mañana?
好呀，一齊去。|hou2 aa3 jat1 cai4 heoi3|Yes, let us go together.|好，一起去吧。|いいですね、一緒に行きましょう。|좋아요, 같이 가요.|Oui, allons-y ensemble.|Sí, vamos juntos.
一齊去公園，好唔好？|jat1 cai4 heoi3 gung1 jyun2 hou2 m4 hou2|Shall we go to the park together?|一起去公園，好嗎？|一緒に公園へ行きませんか。|같이 공원에 갈까요?|On va au parc ensemble ?|¿Vamos juntos al parque?
我哋三點喺門口等。|ngo5 dei6 saam1 dim2 hai2 mun4 hau2 dang2|We will meet at the entrance at three.|我們三點在門口等。|三時に入口で待ち合わせましょう。|세 시에 입구에서 만나요.|On se retrouve à l’entrée à trois heures.|Nos encontramos a las tres en la entrada.`),
 turns:[[6,[4,5]],[8,[7]]],chunks:{4:['我','聽日','得閒。'],5:['對唔住，','我','冇時間。']}
},
{
 id:'stories',icon:'📖',names:['Talking about past experiences','講述經歷','過去の経験を話す','지난 경험 말하기','Raconter ses expériences','Contar experiencias'],
 tip:['咗 marks a completed event. 過 after a verb describes having had an experience.','「咗」標記已發生的動作；動詞後的「過」表示曾有某種經驗。','咗は完了した出来事を、動詞の後の過は経験を表します。','咗는 완료된 사건을, 동사 뒤의 過는 경험을 나타냅니다.','咗 marque un événement accompli. 過 après le verbe exprime une expérience vécue.','咗 marca un hecho completado. 過 después del verbo expresa haber vivido una experiencia.'],
 rows:rows(`尋日|cam4 jat6|yesterday|昨天|昨日|어제|hier|ayer
上個星期|soeng6 go3 sing1 kei4|last week|上星期|先週|지난주|la semaine dernière|la semana pasada
以前|ji5 cin4|before now|以前|以前|이전|auparavant|antes
之後|zi1 hau6|afterwards|之後|その後|그 후|ensuite|después
尋日我去咗公園。|cam4 jat6 ngo5 heoi3 zo2 gung1 jyun2|I went to the park yesterday.|昨天我去了公園。|昨日公園に行きました。|어제 공원에 갔어요.|Je suis allé au parc hier.|Ayer fui al parque.
我去過香港。|ngo5 heoi3 gwo3 hoeng1 gong2|I have been to Hong Kong.|我去過香港。|香港に行ったことがあります。|홍콩에 가 본 적이 있어요.|Je suis déjà allé à Hong Kong.|He estado en Hong Kong.
你尋日去咗邊？|nei5 cam4 jat6 heoi3 zo2 bin1|Where did you go yesterday?|你昨天去了哪裏？|昨日どこへ行きましたか。|어제 어디에 갔어요?|Où es-tu allé hier ?|¿Adónde fuiste ayer?
我未去過。|ngo5 mei6 heoi3 gwo3|I have never been there.|我沒有去過。|行ったことがありません。|가 본 적이 없어요.|Je n’y suis jamais allé.|Nunca he estado allí.
你去過香港未？|nei5 heoi3 gwo3 hoeng1 gong2 mei6|Have you ever been to Hong Kong?|你去過香港嗎？|香港に行ったことがありますか。|홍콩에 가 본 적이 있나요?|Es-tu déjà allé à Hong Kong ?|¿Has estado alguna vez en Hong Kong?
我食完飯就返屋企。|ngo5 sik6 jyun4 faan6 zau6 faan1 uk1 kei2|I went home after finishing the meal.|我吃完飯就回家。|ご飯を食べ終えて家に帰りました。|밥을 다 먹고 집에 갔어요.|Je suis rentré après le repas.|Volví a casa después de comer.`),
 turns:[[6,[4]],[8,[5,7]]],chunks:{4:['尋日','我','去咗','公園。'],5:['我','去過','香港。']}
},
{
 id:'opinions',icon:'💬',names:['Opinions and comparisons','意見與比較','意見と比較','의견과 비교','Avis et comparaisons','Opiniones y comparaciones'],
 tip:['Use 覺得 to give an opinion and 比 to compare. 因為 introduces a reason.','「覺得」表達意見，「比」用來比較，「因為」引出原因。','覺得で意見を、比で比較を表します。因為で理由を述べます。','覺得로 의견을, 比로 비교를 나타냅니다. 因為는 이유를 소개합니다.','覺得 exprime un avis, 比 une comparaison et 因為 une raison.','覺得 expresa una opinión, 比 una comparación e 因為 una razón.'],
 rows:rows(`快|faai3|fast|快|速い|빠르다|rapide|rápido
慢|maan6|slow|慢|遅い|느리다|lent|lento
平|peng4|inexpensive|便宜|安い|저렴하다|bon marché|barato
貴|gwai3|expensive|昂貴|高い|비싸다|cher|caro
我覺得呢本書好睇。|ngo5 gok3 dak1 ni1 bun2 syu1 hou2 tai2|I think this book is a good read.|我覺得這本書很好看。|この本は面白いと思います。|이 책이 재미있다고 생각해요.|Je trouve ce livre intéressant.|Creo que este libro es entretenido.
呢個比嗰個平。|ni1 go3 bei2 go2 go3 peng4|This one is cheaper than that one.|這個比那個便宜。|これはあれより安いです。|이것이 저것보다 저렴해요.|Celui-ci est moins cher que celui-là.|Este es más barato que aquel.
你覺得呢本書點？|nei5 gok3 dak1 ni1 bun2 syu1 dim2|What do you think of this book?|你覺得這本書怎樣？|この本をどう思いますか。|이 책이 어떻다고 생각해요?|Que penses-tu de ce livre ?|¿Qué te parece este libro?
因為呢個平啲。|jan1 wai6 ni1 go3 peng4 di1|Because this one is cheaper.|因為這個比較便宜。|こちらのほうが安いからです。|이것이 더 저렴하기 때문이에요.|Parce que celui-ci est moins cher.|Porque este es más barato.
你點解揀呢個？|nei5 dim2 gaai2 gaan2 ni1 go3|Why did you choose this one?|你為甚麼選這個？|なぜこれを選んだのですか。|왜 이것을 골랐어요?|Pourquoi as-tu choisi celui-ci ?|¿Por qué elegiste este?
我同意你嘅講法。|ngo5 tung4 ji3 nei5 ge3 gong2 faat3|I agree with what you said.|我同意你的說法。|あなたの意見に賛成です。|당신이 한 말에 동의해요.|Je suis d’accord avec ce que tu dis.|Estoy de acuerdo con lo que dices.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['我覺得','呢本書','好睇。'],5:['呢個','比','嗰個','平。']}
},
{
 id:'problems',icon:'🧩',names:['Solving problems together','一齊解決問題','一緒に問題を解決する','함께 문제 해결하기','Résoudre les problèmes ensemble','Resolver problemas juntos'],
 tip:['先…再… puts actions in order. 搵唔到 means being unable to find something.','「先……再……」安排次序；「搵唔到」表示找不到。','先…再…で順序を表します。搵唔到は「見つからない」です。','先…再…는 순서를 나타냅니다. 搵唔到는 찾을 수 없다는 뜻입니다.','先…再… ordonne deux actions. 搵唔到 signifie ne pas réussir à trouver.','先…再… ordena acciones. 搵唔到 significa no conseguir encontrar algo.'],
 rows:rows(`鎖匙|so2 si4|keys|鑰匙|鍵|열쇠|clés|llaves
銀包|ngan4 baau1|wallet|錢包|財布|지갑|portefeuille|cartera
唔見咗|m4 gin3 zo2|gone missing|不見了|なくなった|없어졌다|disparu|desaparecido
再試|zoi3 si3|try again|再試|もう一度試す|다시 시도하다|réessayer|intentarlo otra vez
我搵唔到鎖匙。|ngo5 wan2 m4 dou2 so2 si4|I cannot find my keys.|我找不到鑰匙。|鍵が見つかりません。|열쇠를 찾을 수 없어요.|Je ne trouve pas mes clés.|No encuentro mis llaves.
我哋先搵吓，再問人。|ngo5 dei6 sin1 wan2 haa5 zoi3 man6 jan4|Let us look first, then ask someone.|我們先找一下，再問別人。|まず探してから人に聞きましょう。|먼저 찾아보고 다른 사람에게 물어봐요.|Cherchons d’abord, puis demandons à quelqu’un.|Busquemos primero y después preguntemos a alguien.
你搵緊咩？|nei5 wan2 gan2 me1|What are you looking for?|你正在找甚麼？|何を探していますか。|무엇을 찾고 있어요?|Qu’est-ce que tu cherches ?|¿Qué estás buscando?
好呀，唔該晒。|hou2 aa3 m4 goi1 saai3|Yes, thank you very much for helping.|好，非常感謝你的幫忙。|はい、手伝ってくれて本当にありがとう。|네, 도와주셔서 정말 감사해요.|Oui, merci beaucoup pour ton aide.|Sí, muchas gracias por ayudarme.
我幫你搵，好唔好？|ngo5 bong1 nei5 wan2 hou2 m4 hou2|Shall I help you look for it?|我幫你找，好嗎？|一緒に探しましょうか。|찾는 것을 도와줄까요?|Veux-tu que je t’aide à chercher ?|¿Te ayudo a buscarlo?
唔緊要，我哋再試。|m4 gan2 jiu3 ngo5 dei6 zoi3 si3|It is okay; let us try again.|不要緊，我們再試。|大丈夫、もう一度やってみましょう。|괜찮아요, 다시 해 봐요.|Ce n’est pas grave, essayons encore.|No pasa nada, intentémoslo otra vez.`),
 turns:[[6,[4]],[8,[7]]],chunks:{4:['我','搵唔到','鎖匙。'],5:['我哋','先搵吓，','再問人。']}
}
];
