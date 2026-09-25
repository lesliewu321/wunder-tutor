import type { PhonemeId } from '../domain/types';
import { tc } from '../i18n';
import { EN } from './course';
import { FR_LADDERS } from './fr/course';
import { JA_LADDERS } from './ja/course';
import { KO_LADDERS } from './ko/course';
import { ES_LADDERS } from './es/course';
import { type Ladder, type LabStage, LAB_STAGES as STAGES } from './load';
import { ZH_LADDERS } from './zh/course';

export type { LabStage } from './load';
export const LAB_STAGES: LabStage[] = [...STAGES];
/** The rungs' names in English — the source. To show one, use `stageLabel`. */
export const STAGE_LABEL: Record<LabStage, string> = { syllables: 'Syllables', words: 'Words', phrases: 'Phrases', sentence: 'Sentence' };
/** A rung's name in the App language, looked up when asked for (content.json: `lab.ladder.words.name`). */
export const stageLabel = (stage: LabStage): string => tc(`lab.ladder.${stage}.name`, STAGE_LABEL[stage]);

/** Sound → syllable → word → phrase → sentence ladders for deliberate practice: Mandarin "zh:…", French, Japanese, then English (content/courses/en.json). */
export const LADDERS: Record<PhonemeId, Ladder> = {
  ...ZH_LADDERS,
  ...FR_LADDERS,
  ...JA_LADDERS,
  ...KO_LADDERS,
  ...ES_LADDERS,
  ...EN.ladders,
};
