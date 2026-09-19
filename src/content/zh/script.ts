import type { SpeakItem } from '../../domain/types';

// Which characters a learner reads. Our Mandarin text is written in Simplified characters, like the scorer's
// reference text; most Hong Kong learners read Traditional. Course items carry both forms (course.ts). The sound
// guides (sounds.ts) and unit names use only a handful of characters, converted here; a test keeps this complete.

export type ZhScript = 'hant' | 'hans';

/** Simplified → Traditional for every character our own copy (sound guides, unit names) uses that differs. */
export const HANT: Record<string, string> = {
  妈: '媽', 马: '馬', 鱼: '魚', 绿: '綠', 汤: '湯', 贪: '貪', 伤: '傷', 资: '資', 动: '動', 学: '學', 饮: '飲', 话: '話',
};

let display: ZhScript = 'hant';

/** The active learner's script. The store keeps it in step with the learner and their settings. */
export const setDisplayScript = (script: ZhScript): void => { display = script; };
export const displayScript = (): ZhScript => display;

/** Our own copy (tips, examples) in the learner's script. */
export const inScript = (text: string, script: ZhScript = display): string =>
  script === 'hans' ? text : text.replace(/\p{Script=Han}/gu, (c) => HANT[c] ?? c);

/** The Chinese characters of a text, in order (punctuation and Latin letters dropped). */
export const hanChars = (text: string): string[] => [...text].filter((c) => /\p{Script=Han}/u.test(c));

/** A practice item's text as the learner reads it. */
export const shownText = (item: Pick<SpeakItem, 'text' | 'zh'>, script: ZhScript = display): string =>
  item.zh && script === 'hant' ? item.zh.hant : item.text;
