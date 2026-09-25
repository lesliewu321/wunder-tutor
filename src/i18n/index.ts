// The app's own wording, in the language the family chose (Settings → App language; asked on the first screen).
// English is the source; 繁體中文 (Hong Kong) is the first translation, 简体中文 is made from it (npm run i18n:hans), and
// 日本語, 한국어, Français and Español follow the courses (Leslie, 2026-09-25: "add all the course languages to app language").
// English and 繁體中文 are in the app bundle; the others are fetched when chosen (`loadLanguage`) and show English until
// they arrive. What is being LEARNED — the words to say, the
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
import twisters from './en/twisters.json';
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
import zhTwisters from './zh-Hant/twisters.json';

export type Language = 'en' | 'zh-Hant' | 'zh-Hans' | 'ja' | 'ko' | 'fr' | 'es';
/** In the order of the courses. `locale` is for dates. */
export const LANGUAGES: { id: Language; label: string; htmlLang: string; locale: string }[] = [
  { id: 'en', label: 'English', htmlLang: 'en', locale: 'en-GB' },
  { id: 'zh-Hant', label: '繁體中文', htmlLang: 'zh-Hant-HK', locale: 'zh-HK' },
  { id: 'zh-Hans', label: '简体中文', htmlLang: 'zh-Hans-CN', locale: 'zh-CN' },
  { id: 'ja', label: '日本語', htmlLang: 'ja', locale: 'ja-JP' },
  { id: 'ko', label: '한국어', htmlLang: 'ko', locale: 'ko-KR' },
  { id: 'fr', label: 'Français', htmlLang: 'fr', locale: 'fr-FR' },
  { id: 'es', label: 'Español', htmlLang: 'es', locale: 'es-ES' },
];
export const isLanguage = (v: unknown): v is Language => LANGUAGES.some((l) => l.id === v);

export const en = { ...common, ...onboarding, ...settings, ...speak, ...feedback, ...home, ...lesson, ...lab, ...practice, ...progress, ...twisters };
export type Key = keyof typeof en;
type Params = Record<string, string | number>;

type Catalog = Partial<Record<string, string>>;
const INTERFACE: Partial<Record<Language, Catalog>> = {
  en,
  'zh-Hant': { ...zhCommon, ...zhOnboarding, ...zhSettings, ...zhSpeak, ...zhFeedback, ...zhHome, ...zhLesson, ...zhLab, ...zhPractice, ...zhProgress, ...zhTwisters },
};
const CONTENT: Partial<Record<Language, Catalog>> = { en: {}, 'zh-Hant': { ...zhContent, ...zhContentCourse, ...astraContent } };
/** Lesson guides and reading questions, keyed by their English (`tl`). 繁體中文 keeps its own in the course data. */
const LESSONS: Partial<Record<Language, Catalog>> = { en: {} };

// Components re-render when a fetched language arrives (useT subscribes to this).
let revision = 0;
const listeners = new Set<() => void>();
export const onCatalogs = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const catalogRevision = (): number => revision;

// The other languages: every JSON file under src/i18n/<language>/, fetched as separate chunks. `content.json` is the
// wording that lives with data, `lessons.json` the lesson guides; every other file is part of the interface.
const FILES = import.meta.glob<{ default: Catalog }>(['./zh-Hans/*.json', './ja/*.json', './ko/*.json', './fr/*.json', './es/*.json']);
const loading = new Map<Language, Promise<void>>();

/** Fetches a language's wording once; resolves when it is ready (at once for English and 繁體中文). */
export const loadLanguage = (l: Language): Promise<void> => {
  if (INTERFACE[l]) return Promise.resolve();
  let p = loading.get(l);
  if (!p) {
    p = (async () => {
      const ui: Catalog = {}, content: Catalog = {}, lessons: Catalog = {};
      await Promise.all(Object.entries(FILES).filter(([path]) => path.startsWith(`./${l}/`)).map(async ([path, load]) => {
        const words = (await load()).default;
        Object.assign(path.endsWith('/content.json') ? content : path.endsWith('/lessons.json') ? lessons : ui, words);
      }));
      INTERFACE[l] = ui; CONTENT[l] = content; LESSONS[l] = lessons;
      revision++;
      for (const listener of listeners) listener();
    })().catch((e) => { loading.delete(l); console.warn('[i18n] could not load', l, e); });
    loading.set(l, p);
  }
  return p;
};

let current: Language = 'en';

/** The store keeps this in step with the setting (src/state/store.ts), so wording outside React follows it too. */
export const setLanguage = (l: Language): void => {
  current = isLanguage(l) ? l : 'en';
  void loadLanguage(current);
  if (typeof document !== 'undefined') document.documentElement.lang = LANGUAGES.find((x) => x.id === current)?.htmlLang ?? 'en';
};
export const language = (): Language => current;
/** Chinese in either script. */
export const isChinese = (l: Language = current): boolean => l === 'zh-Hant' || l === 'zh-Hans';
/** The locale for dates in the App language. */
export const dateLocale = (): string => LANGUAGES.find((x) => x.id === current)?.locale ?? 'en-GB';

/**
 * Languages the app may START in by itself, from the device's own language. 繁體中文 joins this list once Leslie has
 * checked the translation (2026-09-20: drafted, not yet checked) — until then a Chinese phone starts in English and
 * the family switches by hand, on the first screen or in Settings.
 */
const STARTS_IN: Language[] = ['en'];

/** The language to start in, before anyone has chosen: Chinese for a device set to any kind of Chinese (see STARTS_IN). */
export const deviceLanguage = (): Language => {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const pref of prefs) {
    const tag = (pref ?? '').toLowerCase();
    const wanted: Language | null = /^zh-(hans|cn|sg)\b/.test(tag) ? 'zh-Hans' : /^zh\b/.test(tag) ? 'zh-Hant'
      : (['ja', 'ko', 'fr', 'es'] as const).find((l) => tag === l || tag.startsWith(`${l}-`)) ?? (tag.startsWith('en') ? 'en' : null);
    if (wanted) return STARTS_IN.includes(wanted) ? wanted : 'en';
  }
  return 'en';
};

const fill = (text: string, params?: Params): string => (params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text);

/** A line of the interface: `t('settings.title')`, `t('home.next', { title })`. */
export const t = (key: Key, params?: Params): string => fill(INTERFACE[current]?.[key] ?? en[key], params);

/**
 * A line that counts: `tn('settings.recordings', n)` reads `settings.recordings.one` for exactly one where the
 * language has such a line (English does, Chinese doesn't need one), else `settings.recordings.other`. `{n}` is filled.
 */
export const tn = (key: string, n: number, params?: Params): string => {
  const own: Catalog = INTERFACE[current] ?? en, one = `${key}.one`, other = `${key}.other`;
  const text = own[other] != null || own[one] != null
    ? (n === 1 && own[one] != null ? own[one] : own[other] ?? own[one])
    : (n === 1 && one in en ? en[one as Key] : en[other as Key]);
  return fill(text ?? key, { n, ...params });
};

/** Wording that lives with its data: the translation under `key` if there is one, else the data's own English. */
export const tc = (key: string, english: string, params?: Params): string => {
  seen?.set(key, english);
  return fill(CONTENT[current]?.[key] ?? english, params);
};

/**
 * A lesson guide's or a reading question's wording: the course data carries the English and the 繁體中文 (`hant`); the
 * other languages translate the English line itself (src/i18n/<language>/lessons.json), so an edited line shows in
 * English until it is translated again rather than showing a stale translation.
 */
export const tl = (english: string, hant: string): string => (current === 'zh-Hant' ? hant : LESSONS[current]?.[english] ?? english);

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

/** Sentences in a row: Chinese and Japanese run them together; the others put a space between them. */
export const sentences = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(isChinese() || current === 'ja' ? '' : ' ');

/** For tests and the review export. */
export const catalogs = { interface: INTERFACE, content: CONTENT, lessons: LESSONS };
