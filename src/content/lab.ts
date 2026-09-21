import type { PhonemeId, SpeakItem } from '../domain/types';
import { tc } from '../i18n';
import { FR_LADDERS } from './fr/course';
import { JA_LADDERS } from './ja/course';
import { ZH_LADDERS } from './zh/course';

export type LabStage = 'syllables' | 'words' | 'phrases' | 'sentence';
export const LAB_STAGES: LabStage[] = ['syllables', 'words', 'phrases', 'sentence'];
/** The rungs' names in English — the source. To show one, use `stageLabel`. */
export const STAGE_LABEL: Record<LabStage, string> = { syllables: 'Syllables', words: 'Words', phrases: 'Phrases', sentence: 'Sentence' };
/** A rung's name in the App language, looked up when asked for (content.json: `lab.ladder.words.name`). */
export const stageLabel = (stage: LabStage): string => tc(`lab.ladder.${stage}.name`, STAGE_LABEL[stage]);

const mk = (sound: PhonemeId, kind: SpeakItem['kind'], text: string, picture?: string, say?: string): SpeakItem => ({
  id: `lab-${sound}-${text.toLowerCase().replace(/[^a-z]+/g, '-')}`, text, kind, picture, say, focus: [sound],
});

type Ladder = Record<LabStage, SpeakItem[]>;

const ladder = (s: PhonemeId, syl: [string, string][], words: [string, string][], phrases: string[], sentence: string): Ladder => ({
  syllables: syl.map(([t, say]) => mk(s, 'syllable', t, undefined, say)),
  words: words.map(([t, pic]) => mk(s, 'word', t, pic)),
  phrases: phrases.map((t) => mk(s, 'phrase', t)),
  sentence: [mk(s, 'sentence', sentence)],
});

/** Sound → syllable → word → phrase → sentence ladders for deliberate practice (English, then Mandarin "zh:…"). */
export const LADDERS: Record<PhonemeId, Ladder> = {
  ...ZH_LADDERS,
  ...FR_LADDERS,
  ...JA_LADDERS,
  'θ': ladder('θ', [['tha', 'thah'], ['thee', 'thee'], ['thoo', 'thoo']], [['three', '3️⃣'], ['thank', '💛'], ['mouth', '👄']], ['thank you', 'three things'], 'I think I am thirsty.'),
  'r': ladder('r', [['ra', 'rah'], ['ree', 'ree'], ['roo', 'roo']], [['red', '🔴'], ['right', '➡️'], ['around', '🔄']], ['right now', 'around the corner'], 'Turn right at the next street.'),
  'ð': ladder('ð', [['the', 'the'], ['they', 'they'], ['though', 'though']], [['this', '👇'], ['that', '👉'], ['mother', '👩']], ['this one', 'my brother'], 'This is my mother and that is my brother.'),
  'v': ladder('v', [['va', 'vah'], ['vee', 'vee'], ['voo', 'voo']], [['very', '⭐'], ['five', '5️⃣'], ['seven', '7️⃣']], ['very good', 'five vegetables'], 'We love to visit the village.'),
  'w': ladder('w', [['wa', 'wah'], ['wee', 'wee'], ['woo', 'woo']], [['water', '💧'], ['we', '👫'], ['want', '🙏']], ['we want', 'warm water'], 'We want some warm water.'),
  'l': ladder('l', [['la', 'lah'], ['lee', 'lee'], ['loo', 'loo']], [['like', '👍'], ['lemon', '🍋'], ['yellow', '🟡']], ['I like', 'yellow lemon'], 'I would like a little lemonade.'),
  'æ': ladder('æ', [['at', 'at'], ['am', 'am'], ['add', 'add']], [['apple', '🍎'], ['cat', '🐱'], ['happy', '😊']], ['a happy cat', 'that hat'], 'The happy cat sat on my hat.'),
  'ɪ': ladder('ɪ', [['it', 'it'], ['in', 'in'], ['is', 'is']], [['milk', '🥛'], ['fish', '🐟'], ['chicken', '🍗']], ['big fish', 'a little bit'], 'The big fish is in the dish.'),
};
