import type { Scenario } from '../scenarios';
import { es } from './item';

// Conversations in Spanish (Spain), for the Spanish course: the same three scenes as the English, Putonghua, French
// and Japanese courses.
//
// The learner's lines are the ones that get scored and coached, so they are short, polite, and never gendered
// ("juntos / juntas", "bienvenido / bienvenida") — a girl and a boy say the same line. The tutor's lines are only
// listened to and may be as natural as Spanish is: adults say tú to a child, and a waiter or guide says usted to an
// adult (the teen band), as in Spain. The new friend has a pretend name (Lucía) and asks only about colours and games.

const T = {
  // El Café Sol
  tienesHambre: es('¡Hola! ¿Tienes hambre?', 'Hello! Are you hungry?'),
  quieresLeche: es('¿Quieres leche?', 'Would you like some milk?'),
  yUnChurro: es('¿Y un churro?', 'And a churro?'),
  aquíTienes: es('Aquí tienes.', 'Here you are.'),
  buenosDíasHambre: es('¡Hola, buenos días! ¿Tienes hambre?', 'Hello, good morning! Are you hungry?'),
  beberUnZumo: es('¿Quieres beber un zumo?', 'Would you like a juice?'),
  yParaComer: es('¿Y para comer?', 'And to eat?'),
  queAproveche: es('¡Aquí tienes! ¡Que aproveche!', 'Here you are! Enjoy your meal!'),
  quéDeseaBeber: es('Buenos días. ¿Qué desea beber?', 'Good morning. What would you like to drink?'),
  muyBienParaComer: es('Muy bien. ¿Y para comer?', 'Very good. And to eat?'),
  estáRico: es('¿Está rico?', 'Is it tasty?'),
  deseaAlgoMás: es('¿Desea algo más?', 'Would you like anything else?'),

  // El zoo de Madrid
  gustanLeones: es('¡Hola! ¿Te gustan los leones?', 'Hello! Do you like lions?'),
  quéEs: es('¡Mira! ¿Qué es?', 'Look! What is it?'),
  esBonito: es('Es bonito, ¿verdad?', 'It’s beautiful, isn’t it?'),
  seAcabó: es('¡Se acabó! ¡Adiós!', 'Time to go! Goodbye!'),
  gustanAnimales: es('¡Hola! ¿Te gustan los animales?', 'Hello! Do you like animals?'),
  vesElLeón: es('¡Mira! ¿Ves el león?', 'Look! Can you see the lion?'),
  tuAnimal: es('¿Cuál es tu animal favorito?', 'What is your favourite animal?'),
  zooCierraTe: es('El zoo cierra pronto. ¿Te ha gustado?', 'The zoo closes soon. Did you enjoy it?'),
  primeraVisita: es('Buenos días. ¿Es su primera visita al zoo?', 'Good morning. Is this your first visit to the zoo?'),
  leonesOMonos: es('¿Quiere ver los leones o los monos?', 'Would you like to see the lions or the monkeys?'),
  suAnimal: es('¿Cuál es su animal favorito?', 'What is your favourite animal?'),
  zooCierraLe: es('El zoo cierra pronto. ¿Le ha gustado?', 'The zoo closes soon. Did you enjoy it?'),

  // Una nueva amiga
  lucía: es('¡Hola! Me llamo Lucía.', 'Hi! My name is Lucía.'),
  rojoYATi: es('Me gusta el rojo. ¿Y a ti?', 'I like red. What about you?'),
  jugamos: es('¿Jugamos?', 'Shall we play?'),
  lucíaQuéTal: es('¡Hola! Me llamo Lucía. ¿Qué tal?', 'Hi! My name is Lucía. How are you?'),
  miColor: es('Mi color favorito es el rojo. ¿Y el tuyo?', 'My favourite colour is red. What about yours?'),
  jugarConmigo: es('¡Genial! ¿Quieres jugar conmigo?', 'Great! Do you want to play with me?'),
  noNosConocemos: es('¡Hola! Soy Lucía. Creo que no nos conocemos.', 'Hi! I’m Lucía. I don’t think we’ve met.'),
  fútbol: es('Me encanta el fútbol. ¿Y a ti, qué te gusta?', 'I love football. What do you like?'),
  teVienes: es('¡Guay! Estamos jugando allí. ¿Te vienes?', 'Cool! We’re playing over there. Are you coming?'),
};

/** What the learner can say back — short, polite, and the same for a girl and a boy. */
const R = {
  // El Café Sol
  síTengoHambre: es('Sí, tengo hambre.', 'Yes, I’m hungry.', '😋'),
  hola: es('Hola.', 'Hello.', '👋'),
  lechePorFavor: es('Leche, por favor.', 'Milk, please.', '🥛'),
  aguaPorFavor: es('Agua, por favor.', 'Water, please.', '💧'),
  síUnChurro: es('Sí, un churro.', 'Yes, a churro.', '🥖'),
  noGracias: es('No, gracias.', 'No, thank you.', '🙅'),
  gracias: es('Gracias.', 'Thank you.', '🙏'),
  muchaHambre: es('Sí, tengo mucha hambre.', 'Yes, I’m very hungry.', '😋'),
  unPocoGracias: es('Un poco, gracias.', 'A little, thank you.', '🤏'),
  síUnZumo: es('Sí, un zumo, por favor.', 'Yes, a juice, please.', '🧃'),
  quieroAgua: es('Quiero agua, por favor.', 'I’d like some water, please.', '💧'),
  unBocadillo: es('Quiero un bocadillo.', 'I’d like a sandwich.', '🥪'),
  panConQueso: es('Quiero pan con queso.', 'I’d like bread with cheese.', '🧀'),
  muchasGracias: es('Muchas gracias.', 'Thank you very much.', '💛'),
  caféConLeche: es('Un café con leche, por favor.', 'A coffee with milk, please.', '☕'),
  tostadaConTomate: es('Una tostada con tomate, por favor.', 'Toast with tomato, please.', '🍅'),
  unaEnsalada: es('Quiero una ensalada.', 'I’d like a salad.', '🥗'),
  estáMuyRico: es('Sí, está muy rico.', 'Yes, it’s very tasty.', '😋'),
  buenísimo: es('Sí, está buenísimo, gracias.', 'Yes, it’s delicious, thank you.', '🤤'),
  laCuenta: es('La cuenta, por favor.', 'The bill, please.', '🧾'),
  esoEsTodo: es('No, gracias. Eso es todo.', 'No, thank you. That’s all.', '👌'),

  // El zoo de Madrid
  sí: es('¡Sí!', 'Yes!', '✅'),
  gustanLeones: es('Sí, me gustan los leones.', 'Yes, I like lions.', '🦁'),
  unMono: es('¡Un mono!', 'A monkey!', '🐒'),
  unTigre: es('¡Un tigre!', 'A tiger!', '🐯'),
  esBonito: es('Sí, es bonito.', 'Yes, it’s beautiful.', '😍'),
  meGusta: es('Sí, me gusta.', 'Yes, I like it.', '😊'),
  adiós: es('Adiós.', 'Goodbye.', '👋'),
  muchoLosMonos: es('Sí, me gustan mucho los monos.', 'Yes, I really like monkeys.', '🐒'),
  tresLeones: es('Sí, veo tres leones.', 'Yes, I can see three lions.', '🦁'),
  monoPequeño: es('Veo un mono pequeño.', 'I can see a little monkey.', '🐒'),
  meGustaElLeón: es('Me gusta el león.', 'I like the lion.', '🦁'),
  prefieroElTigre: es('Prefiero el tigre.', 'I prefer the tiger.', '🐯'),
  haSidoGenial: es('Sí, ha sido genial.', 'Yes, it was great.', '🎉'),
  primeraVisita: es('Sí, es mi primera visita.', 'Yes, it’s my first visit.', '🆕'),
  meEncantaEsteZoo: es('No, me encanta este zoo.', 'No, I love this zoo.', '💛'),
  verLosLeones: es('Quiero ver los leones.', 'I’d like to see the lions.', '🦁'),
  losMonos: es('Los monos, por favor.', 'The monkeys, please.', '🐒'),
  prefieroLosLeones: es('Prefiero los leones.', 'I prefer the lions.', '🦁'),
  muchoLosTigres: es('Me gustan mucho los tigres.', 'I really like tigers.', '🐯'),
  genialGracias: es('Ha sido genial, gracias.', 'It was great, thank you.', '🤩'),
  gustadoMucho: es('Sí, me ha gustado mucho.', 'Yes, I really enjoyed it.', '😄'),

  // Una nueva amiga
  holaLucía: es('¡Hola, Lucía!', 'Hi, Lucía!', '👋'),
  aMíTambién: es('¡A mí también!', 'Me too!', '🙌'),
  meGustaElAzul: es('Me gusta el azul.', 'I like blue.', '🔵'),
  síVamos: es('¡Sí, vamos!', 'Yes, let’s go!', '🤸'),
  síGenial: es('¡Sí, genial!', 'Yes, great!', '🎉'),
  lucíaMuyBien: es('¡Hola, Lucía! Muy bien.', 'Hi, Lucía! I’m fine.', '😊'),
  muyBienGracias: es('Muy bien, gracias.', 'Very well, thank you.', '😊'),
  colorAzul: es('Mi color favorito es el azul.', 'My favourite colour is blue.', '🔵'),
  tambiénElRojo: es('A mí también me gusta el rojo.', 'I like red too.', '🔴'),
  síClaro: es('¡Sí, claro!', 'Yes, of course!', '😊'),
  quieroJugar: es('Sí, quiero jugar.', 'Yes, I want to play.', '🤝'),
  creoQueNo: es('No, creo que no.', 'No, I don’t think so.', '🤔'),
  primeraVez: es('No, es mi primera vez aquí.', 'No, it’s my first time here.', '🆕'),
  tambiénElFútbol: es('A mí también me encanta el fútbol.', 'I love football too.', '⚽'),
  leerYDibujar: es('Me gusta leer y dibujar.', 'I like reading and drawing.', '🎨'),
  conMuchoGusto: es('Sí, con mucho gusto.', 'Yes, with pleasure.', '😊'),
  claroQueSí: es('¡Claro que sí, gracias!', 'Of course, thanks!', '😊'),
};

const BYE = {
  adiósHastaPronto: es('¡Adiós, hasta pronto!', 'Goodbye, see you soon!'),
  adiósYHastaPronto: es('¡Adiós y hasta pronto!', 'Goodbye and see you soon!'),
  buenDía: es('Gracias, que tenga un buen día.', 'Thank you, and have a nice day.'),
  graciasHastaPronto: es('Gracias, ¡hasta pronto!', 'Thank you, see you soon!'),
  tuVisita: es('Gracias por tu visita. ¡Adiós!', 'Thanks for your visit. Goodbye!'),
  suVisita: es('Gracias por su visita. ¡Adiós!', 'Thank you for your visit. Goodbye!'),
  haSidoGenial: es('¡Ha sido genial! ¡Adiós!', 'That was great! Goodbye!'),
  hastaMañana: es('¡Ha sido genial! ¡Hasta mañana!', 'That was great! See you tomorrow!'),
  hastaLuego: es('Ha sido divertido. ¡Hasta luego!', 'That was fun. See you later!'),
};

export const ES_SCENARIOS: Scenario[] = [
  {
    id: 'es-cafe', course: 'es', title: 'El Café Sol', icon: '☕', color: 'var(--coral)',
    blurb: { little: 'Ask for a churro in Spanish!', junior: 'Order a drink and a snack in Spanish.', teen: 'Order, taste and ask for the bill in Spanish.' },
    setting: 'A little café in Madrid. The learner is a customer ordering food and drink, in Spanish (Spain).',
    tutorRole: 'a friendly Spanish waiter',
    goals: ['greet', 'order a drink', 'order food', 'say thank you'],
    turns: [
      {
        tutor: { little: T.tienesHambre, junior: T.buenosDíasHambre, teen: T.quéDeseaBeber },
        replies: { little: [R.síTengoHambre, R.hola], junior: [R.muchaHambre, R.unPocoGracias], teen: [R.caféConLeche, R.aguaPorFavor] },
      },
      {
        tutor: { little: T.quieresLeche, junior: T.beberUnZumo, teen: T.muyBienParaComer },
        replies: { little: [R.lechePorFavor, R.aguaPorFavor], junior: [R.síUnZumo, R.quieroAgua], teen: [R.tostadaConTomate, R.unaEnsalada] },
      },
      {
        tutor: { little: T.yUnChurro, junior: T.yParaComer, teen: T.estáRico },
        replies: { little: [R.síUnChurro, R.noGracias], junior: [R.unBocadillo, R.panConQueso], teen: [R.estáMuyRico, R.buenísimo] },
      },
      {
        tutor: { little: T.aquíTienes, junior: T.queAproveche, teen: T.deseaAlgoMás },
        replies: { little: [R.gracias], junior: [R.muchasGracias], teen: [R.laCuenta, R.esoEsTodo] },
      },
    ],
    closing: { little: BYE.adiósHastaPronto, junior: BYE.adiósYHastaPronto, teen: BYE.buenDía },
  },
  {
    id: 'es-zoo', course: 'es', title: 'The Madrid Zoo', icon: '🦁', color: 'var(--leaf)',
    blurb: { little: 'Say hello to the lions in Spanish!', junior: 'Talk about the animals you see, in Spanish.', teen: 'Plan your visit with a guide, in Spanish.' },
    setting: 'The zoo in Madrid. The learner is a visitor talking to a guide about the animals, in Spanish (Spain).',
    tutorRole: 'a friendly zoo guide',
    goals: ['greet', 'name animals', 'say what you like', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.gustanLeones, junior: T.gustanAnimales, teen: T.primeraVisita },
        replies: { little: [R.sí, R.gustanLeones], junior: [R.muchoLosMonos, R.gustanLeones], teen: [R.primeraVisita, R.meEncantaEsteZoo] },
      },
      {
        tutor: { little: T.quéEs, junior: T.vesElLeón, teen: T.leonesOMonos },
        replies: { little: [R.unMono, R.unTigre], junior: [R.tresLeones, R.monoPequeño], teen: [R.verLosLeones, R.losMonos] },
      },
      {
        tutor: { little: T.esBonito, junior: T.tuAnimal, teen: T.suAnimal },
        replies: { little: [R.esBonito, R.meGusta], junior: [R.meGustaElLeón, R.prefieroElTigre], teen: [R.prefieroLosLeones, R.muchoLosTigres] },
      },
      {
        tutor: { little: T.seAcabó, junior: T.zooCierraTe, teen: T.zooCierraLe },
        replies: { little: [R.adiós, R.gracias], junior: [R.haSidoGenial, R.muchasGracias], teen: [R.genialGracias, R.gustadoMucho] },
      },
    ],
    closing: { little: BYE.graciasHastaPronto, junior: BYE.tuVisita, teen: BYE.suVisita },
  },
  {
    id: 'es-friend', course: 'es', title: 'A New Friend', icon: '🎈', color: 'var(--sky)',
    blurb: { little: 'Say hi and play, in Spanish!', junior: 'Meet a new friend at the park, in Spanish.', teen: 'Make small talk with someone new, in Spanish.' },
    setting: 'A park. The learner meets a friendly child called Lucía and talks about favourite things, in Spanish (never real personal details).',
    tutorRole: 'Lucía, a friendly kid at the park',
    goals: ['greet', 'talk about favourite things', 'suggest playing', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.lucía, junior: T.lucíaQuéTal, teen: T.noNosConocemos },
        replies: { little: [R.holaLucía, R.hola], junior: [R.lucíaMuyBien, R.muyBienGracias], teen: [R.creoQueNo, R.primeraVez] },
      },
      {
        tutor: { little: T.rojoYATi, junior: T.miColor, teen: T.fútbol },
        replies: { little: [R.aMíTambién, R.meGustaElAzul], junior: [R.colorAzul, R.tambiénElRojo], teen: [R.tambiénElFútbol, R.leerYDibujar] },
      },
      {
        tutor: { little: T.jugamos, junior: T.jugarConmigo, teen: T.teVienes },
        replies: { little: [R.síVamos, R.síGenial], junior: [R.síClaro, R.quieroJugar], teen: [R.conMuchoGusto, R.claroQueSí] },
      },
    ],
    closing: { little: BYE.haSidoGenial, junior: BYE.hastaMañana, teen: BYE.hastaLuego },
  },
];

/** Every line a learner may say in a Spanish conversation, for the tests that hold them to the spelling rules. */
export const ES_SCENARIO_REPLIES = Object.values(R);
