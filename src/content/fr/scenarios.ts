import type { Scenario } from '../scenarios';
import { fr } from './course';

// Conversations in French, for the French course: the same three scenes as the English and Putonghua courses.
//
// The learner's lines are the ones that get scored and coached, so every word in them is in the lexicon (a test holds
// it to that), and they avoid what the lexicon deliberately does not model — no liaison in a learner's line
// ("les amis"), and nothing gendered ("nouveau / nouvelle"), since a girl and a boy say the same line. The tutor's
// lines are only listened to, and may be as natural as French is. Adults say tu to a child and a child says vous to a
// waiter, as in France.

const T = {
  // Le Petit Café
  tuAsFaim: fr('Bonjour ! Tu as faim ?', 'Hello! Are you hungry?'),
  duLait: fr('Tu veux du lait ?', 'Would you like some milk?'),
  etUnCroissant: fr('Et un croissant ?', 'And a croissant?'),
  voilà: fr('Voilà !', 'Here you are!'),
  bienvenueFaim: fr('Bonjour et bienvenue ! Tu as faim ?', 'Hello and welcome! Are you hungry?'),
  boireUnJus: fr('Tu veux boire un jus ?', 'Would you like a juice?'),
  pourManger: fr('Et pour manger ?', 'And to eat?'),
  bonAppétit: fr('Voilà ! Bon appétit !', 'Here you are! Enjoy your meal!'),
  quelqueChose: fr('Bonjour ! Vous voulez boire quelque chose ?', 'Hello! Would you like something to drink?'),
  avecÇa: fr('Très bien. Et avec ça ?', 'Very good. Anything with that?'),
  cestBon: fr("C'est bon ?", 'Is it good?'),
  autreChose: fr('Vous voulez autre chose ?', 'Would you like anything else?'),

  // Au zoo de Paris
  aimesLions: fr('Bonjour ! Tu aimes les lions ?', 'Hello! Do you like lions?'),
  cestQuoi: fr("Regarde ! C'est quoi ?", 'Look! What is it?'),
  ilEstBeau: fr('Il est beau, non ?', 'Isn’t he beautiful?'),
  cestFini: fr("C'est fini ! Au revoir !", 'Time to go! Goodbye!'),
  bienvenueZoo: fr('Bienvenue au zoo ! Tu aimes les animaux ?', 'Welcome to the zoo! Do you like animals?'),
  voisLeLion: fr('Regarde ! Tu vois le lion ?', 'Look! Can you see the lion?'),
  tonAnimal: fr('Quel est ton animal préféré ?', 'What is your favourite animal?'),
  zooFerme: fr("Le zoo ferme bientôt. C'était bien ?", 'The zoo closes soon. Did you enjoy it?'),
  premièreVisite: fr("Bienvenue au zoo ! C'est votre première visite ?", 'Welcome to the zoo! Is this your first visit?'),
  lionsOuSinges: fr('Vous voulez voir les lions ou les singes ?', 'Would you like to see the lions or the monkeys?'),
  votreAnimal: fr('Quel est votre animal préféré ?', 'What is your favourite animal?'),

  // Un nouvel ami
  léo: fr("Salut ! Je m'appelle Léo.", 'Hi! My name is Léo.'),
  rougeEtToi: fr("J'aime le rouge. Et toi ?", 'I like red. What about you?'),
  onJoue: fr('On joue ensemble ?', 'Shall we play together?'),
  léoÇaVa: fr("Salut ! Je m'appelle Léo. Ça va ?", 'Hi! My name is Léo. How are you?'),
  maCouleur: fr("Ma couleur préférée, c'est le rouge. Et toi ?", 'My favourite colour is red. What about you?'),
  jouerAvecMoi: fr('Super ! Tu veux jouer avec moi ?', 'Great! Do you want to play with me?'),
  onSeConnaît: fr("Salut ! Moi, c'est Léo. On ne se connaît pas, je crois.", 'Hi! I’m Léo. I don’t think we’ve met.'),
  foot: fr("J'adore le foot. Et toi, tu aimes quoi ?", 'I love football. What do you like?'),
  tuViens: fr('Cool ! On joue là-bas. Tu viens ?', 'Cool! We’re playing over there. Are you coming?'),
};

/** What the learner can say back — every word in the lexicon. */
const R = {
  // Le Petit Café
  ouiMerci: fr('Oui, merci !', 'Yes, thank you!', '🙂'),
  bonjour: fr('Bonjour !', 'Hello!', '👋'),
  ouiDuLait: fr('Oui, du lait !', 'Yes, some milk!', '🥛'),
  nonDeLEau: fr("Non, de l'eau !", 'No, some water!', '💧'),
  ouiUnCroissant: fr('Oui, un croissant !', 'Yes, a croissant!', '🥐'),
  nonMerci: fr('Non, merci.', 'No, thank you.', '🙅'),
  merci: fr('Merci !', 'Thank you!', '🙏'),
  trèsFaim: fr("Oui, j'ai très faim.", 'Yes, I’m very hungry.', '😋'),
  unPeuMerci: fr('Un peu, merci.', 'A little, thank you.', '🤏'),
  unJus: fr("Oui, un jus, s'il vous plaît.", 'Yes, a juice, please.', '🧃'),
  voudraisDeLEau: fr("Je voudrais de l'eau.", 'I’d like some water.', '💧'),
  voudraisCroissant: fr('Je voudrais un croissant.', 'I’d like a croissant.', '🥐'),
  voudraisFromage: fr('Je voudrais du fromage.', 'I’d like some cheese.', '🧀'),
  merciBeaucoup: fr('Merci beaucoup !', 'Thank you very much!', '💛'),
  voudraisCafé: fr('Oui, je voudrais un café.', 'Yes, I’d like a coffee.', '☕'),
  deLEau: fr("De l'eau, s'il vous plaît.", 'Some water, please.', '💧'),
  unCroissantSvp: fr("Un croissant, s'il vous plaît.", 'A croissant, please.', '🥐'),
  uneSalade: fr('Je voudrais une salade.', 'I’d like a salad.', '🥗'),
  trèsBon: fr("C'est très bon, merci.", 'It’s very good, thank you.', '😋'),
  délicieux: fr("Oui, c'est délicieux !", 'Yes, it’s delicious!', '🤤'),
  lAddition: fr("L'addition, s'il vous plaît.", 'The bill, please.', '🧾'),
  cestTout: fr("Non merci, c'est tout.", 'No thank you, that’s all.', '👌'),

  // Au zoo de Paris
  oui: fr('Oui !', 'Yes!', '✅'),
  aimeLions: fr("Oui, j'aime les lions !", 'Yes, I like lions!', '🦁'),
  unSinge: fr('Un singe !', 'A monkey!', '🐒'),
  unTigre: fr('Un tigre !', 'A tiger!', '🐯'),
  ilEstBeau: fr('Oui, il est beau !', 'Yes, he’s beautiful!', '😍'),
  aimeBien: fr("Oui, j'aime bien !", 'Yes, I like him!', '😊'),
  auRevoir: fr('Au revoir !', 'Goodbye!', '👋'),
  beaucoupSinges: fr("Oui, j'aime beaucoup les singes.", 'Yes, I really like monkeys.', '🐒'),
  troisLions: fr('Oui, je vois trois lions.', 'Yes, I can see three lions.', '🦁'),
  petitSinge: fr('Je vois un petit singe.', 'I can see a little monkey.', '🐒'),
  aimeLeLion: fr("J'aime le lion.", 'I like the lion.', '🦁'),
  préfèreTigre: fr('Je préfère le tigre.', 'I prefer the tiger.', '🐯'),
  cétaitSuper: fr("Oui, c'était super !", 'Yes, it was great!', '🎉'),
  maPremièreVisite: fr("Oui, c'est ma première visite.", 'Yes, it’s my first visit.', '🆕'),
  adoreCeZoo: fr("Non, j'adore ce zoo.", 'No, I love this zoo.', '💛'),
  voirLions: fr('Je voudrais voir les lions.', 'I’d like to see the lions.', '🦁'),
  lesSinges: fr("Les singes, s'il vous plaît.", 'The monkeys, please.', '🐒'),
  préfèreLions: fr('Je préfère les lions.', 'I prefer the lions.', '🦁'),
  beaucoupTigres: fr("J'aime beaucoup les tigres.", 'I really like tigers.', '🐯'),
  génial: fr("C'était génial, merci !", 'It was brilliant, thank you!', '🤩'),
  beaucoupAimé: fr("Oui, j'ai beaucoup aimé.", 'Yes, I really enjoyed it.', '😄'),

  // Un nouvel ami
  salutLéo: fr('Salut, Léo !', 'Hi, Léo!', '👋'),
  moiAussi: fr('Moi aussi !', 'Me too!', '🙌'),
  aimeBleu: fr("J'aime le bleu.", 'I like blue.', '🔵'),
  ouiOnJoue: fr('Oui, on joue !', 'Yes, let’s play!', '🤸'),
  ouiSuper: fr('Oui, super !', 'Yes, great!', '🎉'),
  çaVaBien: fr('Salut, Léo ! Ça va bien.', 'Hi, Léo! I’m fine.', '😊'),
  trèsBien: fr('Très bien, merci.', 'Very well, thank you.', '😊'),
  couleurBleu: fr("Ma couleur préférée, c'est le bleu.", 'My favourite colour is blue.', '🔵'),
  aussiRouge: fr("Moi aussi, j'aime le rouge.", 'I like red too.', '🔴'),
  veuxBien: fr('Oui, je veux bien !', 'Yes, I’d love to!', '😊'),
  jouerEnsemble: fr('Oui, on joue ensemble !', 'Yes, let’s play together!', '🤝'),
  croisPas: fr('Non, je ne crois pas.', 'No, I don’t think so.', '🤔'),
  premièreFois: fr("Non, c'est ma première fois ici.", 'No, it’s my first time here.', '🆕'),
  adoreFoot: fr("Moi aussi, j'adore le foot.", 'Me too, I love football.', '⚽'),
  lireDessiner: fr("J'aime lire et dessiner.", 'I like reading and drawing.', '🎨'),
  avecPlaisir: fr('Oui, avec plaisir !', 'Yes, with pleasure!', '😊'),
  veuxBienMerci: fr('Je veux bien, merci !', 'I’d love to, thanks!', '😊'),
};

const BYE = {
  auRevoir: fr('Au revoir !', 'Goodbye!'),
  àBientôt: fr('Au revoir et à bientôt !', 'Goodbye and see you soon!'),
  bonneJournée: fr('Merci et bonne journée !', 'Thank you, and have a nice day!'),
  merciÀBientôt: fr('Merci, à bientôt !', 'Thank you, see you soon!'),
  taVisite: fr('Merci de ta visite, au revoir !', 'Thanks for your visit, goodbye!'),
  votreVisite: fr('Merci de votre visite, au revoir !', 'Thank you for your visit, goodbye!'),
  cétaitSuper: fr("C'était super ! Au revoir !", 'That was great! Goodbye!'),
  àDemain: fr("C'était super ! À demain !", 'That was great! See you tomorrow!'),
  àPlusTard: fr("C'était sympa. À plus tard !", 'That was fun. See you later!'),
};

export const FR_SCENARIOS: Scenario[] = [
  {
    id: 'fr-cafe', course: 'fr', title: 'Le Petit Café', icon: '🥐', color: 'var(--coral)',
    blurb: { little: 'Ask for a croissant in French!', junior: 'Order a drink and a snack in French.', teen: 'Order, taste and ask for the bill in French.' },
    setting: 'A little café in Paris. The learner is a customer ordering food and drink, in French.',
    tutorRole: 'a friendly French waiter',
    goals: ['greet', 'order a drink', 'order food', 'say thank you'],
    turns: [
      {
        tutor: { little: T.tuAsFaim, junior: T.bienvenueFaim, teen: T.quelqueChose },
        replies: { little: [R.ouiMerci, R.bonjour], junior: [R.trèsFaim, R.unPeuMerci], teen: [R.voudraisCafé, R.deLEau] },
      },
      {
        tutor: { little: T.duLait, junior: T.boireUnJus, teen: T.avecÇa },
        replies: { little: [R.ouiDuLait, R.nonDeLEau], junior: [R.unJus, R.voudraisDeLEau], teen: [R.unCroissantSvp, R.uneSalade] },
      },
      {
        tutor: { little: T.etUnCroissant, junior: T.pourManger, teen: T.cestBon },
        replies: { little: [R.ouiUnCroissant, R.nonMerci], junior: [R.voudraisCroissant, R.voudraisFromage], teen: [R.trèsBon, R.délicieux] },
      },
      {
        tutor: { little: T.voilà, junior: T.bonAppétit, teen: T.autreChose },
        replies: { little: [R.merci], junior: [R.merciBeaucoup], teen: [R.lAddition, R.cestTout] },
      },
    ],
    closing: { little: BYE.auRevoir, junior: BYE.àBientôt, teen: BYE.bonneJournée },
  },
  {
    id: 'fr-zoo', course: 'fr', title: 'The Paris Zoo', icon: '🦁', color: 'var(--leaf)',
    blurb: { little: 'Say hello to the lions in French!', junior: 'Talk about the animals you see, in French.', teen: 'Plan your visit with a guide, in French.' },
    setting: 'The zoo in Paris. The learner is a visitor talking to a guide about the animals, in French.',
    tutorRole: 'a friendly zoo guide',
    goals: ['greet', 'name animals', 'say what you like', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.aimesLions, junior: T.bienvenueZoo, teen: T.premièreVisite },
        replies: { little: [R.oui, R.aimeLions], junior: [R.beaucoupSinges, R.aimeLions], teen: [R.maPremièreVisite, R.adoreCeZoo] },
      },
      {
        tutor: { little: T.cestQuoi, junior: T.voisLeLion, teen: T.lionsOuSinges },
        replies: { little: [R.unSinge, R.unTigre], junior: [R.troisLions, R.petitSinge], teen: [R.voirLions, R.lesSinges] },
      },
      {
        tutor: { little: T.ilEstBeau, junior: T.tonAnimal, teen: T.votreAnimal },
        replies: { little: [R.ilEstBeau, R.aimeBien], junior: [R.aimeLeLion, R.préfèreTigre], teen: [R.préfèreLions, R.beaucoupTigres] },
      },
      {
        tutor: { little: T.cestFini, junior: T.zooFerme, teen: T.zooFerme },
        replies: { little: [R.auRevoir, R.merci], junior: [R.cétaitSuper, R.merciBeaucoup], teen: [R.génial, R.beaucoupAimé] },
      },
    ],
    closing: { little: BYE.merciÀBientôt, junior: BYE.taVisite, teen: BYE.votreVisite },
  },
  {
    id: 'fr-friend', course: 'fr', title: 'A New Friend', icon: '🎈', color: 'var(--sky)',
    blurb: { little: 'Say hi and play, in French!', junior: 'Meet a new friend at the park, in French.', teen: 'Make small talk with someone new, in French.' },
    setting: 'A park. The learner meets a friendly child called Léo and talks about favourite things, in French (never real personal details).',
    tutorRole: 'Léo, a friendly kid at the park',
    goals: ['greet', 'talk about favourite things', 'suggest playing', 'say goodbye'],
    turns: [
      {
        tutor: { little: T.léo, junior: T.léoÇaVa, teen: T.onSeConnaît },
        replies: { little: [R.salutLéo, R.bonjour], junior: [R.çaVaBien, R.trèsBien], teen: [R.croisPas, R.premièreFois] },
      },
      {
        tutor: { little: T.rougeEtToi, junior: T.maCouleur, teen: T.foot },
        replies: { little: [R.moiAussi, R.aimeBleu], junior: [R.couleurBleu, R.aussiRouge], teen: [R.adoreFoot, R.lireDessiner] },
      },
      {
        tutor: { little: T.onJoue, junior: T.jouerAvecMoi, teen: T.tuViens },
        replies: { little: [R.ouiOnJoue, R.ouiSuper], junior: [R.veuxBien, R.jouerEnsemble], teen: [R.avecPlaisir, R.veuxBienMerci] },
      },
    ],
    closing: { little: BYE.cétaitSuper, junior: BYE.àDemain, teen: BYE.àPlusTard },
  },
];

/** Every line a learner may say in a French conversation — the lexicon has to know each word of them. */
export const FR_SCENARIO_REPLIES = Object.values(R);
