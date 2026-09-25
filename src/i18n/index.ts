// The app's own wording, in the language the family chose (Settings → App language; asked on the first screen).
// English is the source; 繁體中文 (Hong Kong) is the first translation. What is being LEARNED — the words to say, the
// teacher's voice, pinyin — never changes with this setting: only instructions, feedback and the grown-up screens do.
//
// Two kinds of wording:
//   * the interface: keys in src/i18n/en/<area>.json (typed — a typo is a compile error), translated in
//     src/i18n/zh-Hant/<area>.json. Anything not yet translated shows in English.
//   * content that lives with its data (the name and tips of a sound, a lesson's title): the English stays in the
//     data, a translation may be given in src/i18n/zh-Hant/content.json under a key built from the data's id (`tc`).
// `npm run i18n:export` writes every line side by side for checking; `npm run i18n:import` takes the checked file back.
import common from './en/common.json';
import feedback from './en/feedback.json';
import home from './en/home.json';
import lab from './en/lab.json';
import lesson from './en/lesson.json';
import onboarding from './en/onboarding.json';
import practice from './en/practice.json';
import progress from './en/progress.json';
import settings from './en/settings.json';
import speak from './en/speak.json';
import zhCommon from './zh-Hant/common.json';
import zhContent from './zh-Hant/content.json';
import zhContentCourse from './zh-Hant/content-course.json';
import astraContent from '../../astra-lessons/i18n/zh-Hant.json';
import zhFeedback from './zh-Hant/feedback.json';
import zhHome from './zh-Hant/home.json';
import zhLab from './zh-Hant/lab.json';
import zhLesson from './zh-Hant/lesson.json';
import zhOnboarding from './zh-Hant/onboarding.json';
import zhPractice from './zh-Hant/practice.json';
import zhProgress from './zh-Hant/progress.json';
import zhSettings from './zh-Hant/settings.json';
import zhSpeak from './zh-Hant/speak.json';

export type Language = 'en' | 'zh-Hant';
export const LANGUAGES: { id: Language; label: string; htmlLang: string }[] = [
  { id: 'en', label: 'English', htmlLang: 'en' },
  { id: 'zh-Hant', label: '繁體中文', htmlLang: 'zh-Hant-HK' },
];

export const en = { ...common, ...onboarding, ...settings, ...speak, ...feedback, ...home, ...lesson, ...lab, ...practice, ...progress };
export type Key = keyof typeof en;
type Params = Record<string, string | number>;

const INTERFACE: Record<Language, Partial<Record<string, string>>> = {
  en,
  'zh-Hant': { ...zhCommon, ...zhOnboarding, ...zhSettings, ...zhSpeak, ...zhFeedback, ...zhHome, ...zhLesson, ...zhLab, ...zhPractice, ...zhProgress },
};
const CONTENT: Record<Language, Partial<Record<string, string>>> = { en: {}, 'zh-Hant': { ...zhContent, ...zhContentCourse, ...astraContent } };

let current: Language = 'en';

/** The store keeps this in step with the setting (src/state/store.ts), so wording outside React follows it too. */
export const setLanguage = (l: Language): void => {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = LANGUAGES.find((x) => x.id === l)?.htmlLang ?? 'en';
};
export const language = (): Language => current;

/**
 * Languages the app may START in by itself, from the device's own language. 繁體中文 joins this list once Leslie has
 * checked the translation (2026-09-20: drafted, not yet checked) — until then a Chinese phone starts in English and
 * the family switches by hand, on the first screen or in Settings.
 */
const STARTS_IN: Language[] = ['en'];

/** The language to start in, before anyone has chosen: Chinese for a device set to any kind of Chinese (see STARTS_IN). */
export const deviceLanguage = (): Language => {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  const wanted: Language = prefs.some((l) => /^zh\b/i.test(l ?? '')) ? 'zh-Hant' : 'en';
  return STARTS_IN.includes(wanted) ? wanted : 'en';
};

const fill = (text: string, params?: Params): string => (params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text);

/** A line of the interface: `t('settings.title')`, `t('home.next', { title })`. */
export const t = (key: Key, params?: Params): string => fill(INTERFACE[current][key] ?? en[key], params);

/**
 * A line that counts: `tn('settings.recordings', n)` reads `settings.recordings.one` for exactly one where the
 * language has such a line (English does, Chinese doesn't need one), else `settings.recordings.other`. `{n}` is filled.
 */
export const tn = (key: string, n: number, params?: Params): string => {
  const own = INTERFACE[current], one = `${key}.one`, other = `${key}.other`;
  const text = own[other] != null || own[one] != null
    ? (n === 1 && own[one] != null ? own[one] : own[other] ?? own[one])
    : (n === 1 && one in en ? en[one as Key] : en[other as Key]);
  return fill(text ?? key, { n, ...params });
};

/** Wording that lives with its data: the translation under `key` if there is one, else the data's own English. */
export const tc = (key: string, english: string, params?: Params): string => {
  seen?.set(key, english);
  return fill(CONTENT[current][key] ?? english, params);
};

/** For the review list: while on, every `tc` call is noted with the English it was given. */
let seen: Map<string, string> | null = null;
export const noteContent = (on: boolean): Map<string, string> | null => (seen = on ? new Map() : null);

/**
 * What the app SAYS ALOUD stays English for now, whatever the App language: the teacher's voice speaks the languages
 * being learned (English, Putonghua) and would read Chinese wording out as nonsense. `inEnglish(() => tipFor(...))`
 * gives any wording as it is in English. (A Cantonese voice for the youngest learners' tips is a later step.)
 */
export const inEnglish = <T>(read: () => T): T => {
  const was = current;
  current = 'en';
  try { return read(); } finally { current = was; }
};

/** Sentences in a row: English puts a space between them, Chinese doesn't. */
export const sentences = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(current === 'en' ? ' ' : '');

/** For tests and the review export. */
export const catalogs = { interface: INTERFACE, content: CONTENT };
