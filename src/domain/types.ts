import { t, type Language } from '../i18n';
// Core domain types shared by every layer (content, speech, engine, UI).
// These mirror the tables in supabase/schema.sql so the local repository can
// later be swapped for a Supabase-backed one without touching the UI.

/** Who is learning: children by age, or a grown-up (a parent, or any adult learner). */
export type AgeBand = 'little' | 'junior' | 'teen' | 'adult';
/** Lessons are written for three bands; grown-ups get the teen material, which is natural, full sentences. */
export type ContentBand = 'little' | 'junior' | 'teen';
export const contentBand = (band: AgeBand): ContentBand => (band === 'adult' ? 'teen' : band);
/** Teens and adults get the grown-up presentation: phonetic symbols, less mascot, no stars. */
export const isGrownUp = (band: AgeBand): boolean => band === 'teen' || band === 'adult';
/** What the protected settings area is called: a parent's Parent Zone, or an adult learner's own settings. */
export const settingsName = (band: AgeBand): string => t(band === 'adult' ? 'common.settings.adult' : 'common.settings.parent');
/** The English accent a child is taught. */
export type Accent = 'en-US' | 'en-GB';
/** What a piece of speech is scored and spoken as: English in the child's accent, or the language of another course. */
export type Locale = Accent | 'zh-CN' | 'fr-FR' | 'ja-JP' | 'ko-KR' | 'es-ES';
export type CourseId = 'en' | 'zh' | 'fr' | 'ja' | 'ko' | 'es';
/** Mandarin tone: 1–4, and 5 for the neutral (light) tone. */
export type Tone = 1 | 2 | 3 | 4 | 5;
/**
 * 'yue' = Cantonese, 'zh' = Mandarin — their speakers make different mistakes in English, so they are kept apart.
 * 'en' = English at home (an expat family in Hong Kong, an English-speaking adult): the Mandarin, French and Japanese
 * courses predict an English speaker's trouble sounds from it; on the English course it simply adds no priors.
 */
export type HomeLanguage = 'en' | 'yue' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'other';
export type Level = 'new' | 'some' | 'confident';
/**
 * Why someone is learning. A child's reasons and a grown-up's are not the same four — a 40-year-old is not learning
 * for school, and a 7-year-old is not learning to order in a restaurant — so both sets live here and setup offers
 * whichever fits the age. Stored with the learner (inside the synced JSON, so no column constrains it); nothing
 * teaches from it yet.
 */
export type Goal = 'school' | 'travel' | 'fun' | 'friends' | 'work' | 'everyday';

export type PhonemeId = string; // IPA symbol, e.g. 'θ', 'r', 'æ'

// ---------- Curriculum ----------

export interface SpeakItem {
  id: string;
  text: string;
  /** Emoji used as the picture for the item. */
  picture?: string;
  /** Short plain-English meaning/context line (junior/teen). */
  meaning?: string;
  kind: 'sound' | 'syllable' | 'word' | 'phrase' | 'sentence';
  /** Phonemes this item deliberately practises. */
  focus?: PhonemeId[];
  /** Spoken form for the reference voice when it differs from the text (e.g. isolated sounds). */
  say?: string;
  /** Mandarin, French, Japanese, Korean and Spanish items carry their own language; everything else is English in the learner's accent. */
  lang?: 'zh-CN' | 'fr-FR' | 'ja-JP' | 'ko-KR' | 'es-ES';
  /** Mandarin items: `text` is Simplified (what the scorer is sent); this adds what the child reads. */
  zh?: ZhText;
  /** Japanese items: `text` is the line as written (kanji and kana, what the scorer is sent); this adds how it is read. */
  ja?: JaText;
  /** Korean items: `text` is the line as written (what the scorer is sent); this adds how it is said. */
  ko?: KoText;
  /** "Speak from a translation" prompts, by the learner's home language; an item without one falls back to a picture prompt. */
  translations?: Partial<Record<HomeLanguage, string>>;
}

export interface JaText {
  /** The whole line in kana, as it is said (the particle は as わ): what the sound model and the voice go by. */
  kana: string;
  /** Hepburn romaji with long vowels marked (arigatō), for a learner who cannot read kana yet. */
  romaji: string;
  /** The line in pieces for printing: each piece's kana reading is printed over it when the piece is kanji. */
  ruby: { text: string; reading?: string }[];
}

export interface KoText {
  /** The line as it is SAID, in hangul with the sound changes applied (국물 → 궁물, 같이 → 가치): the beats and the sounds go by it. */
  pron: string;
  /** Revised Romanization, written by hand (it does not show tensification), for a learner who cannot read hangul yet. */
  romaja: string;
}

export interface ZhText {
  /** Traditional characters, as read in Hong Kong. */
  hant: string;
  /** Numbered pinyin with citation tones, one syllable per character: "wo3 xiang3 he1 shui3". */
  py: string;
}

export type Exercise =
  | { id: string; type: 'read-choice'; passage: SpeakItem; question: string; questionHant: string; options: SpeakItem[]; answer: SpeakItem; explanation: string; explanationHant: string }
  | { id: string; type: 'arrange'; item: SpeakItem; chunks: string[]; chunksHant?: string[] }
  | { id: string; type: 'speak'; item: SpeakItem; prompt?: 'text' | 'image' | 'translation' }
  | { id: string; type: 'choose-heard'; answer: SpeakItem; options: SpeakItem[] }
  | { id: string; type: 'minimal-pair'; pair: [SpeakItem, SpeakItem]; answerIndex: 0 | 1; focus: PhonemeId }
  | { id: string; type: 'dialogue'; tutorLine: string; replies: SpeakItem[]; picture?: string; tutor?: SpeakItem };

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  icon: string;
  kind: 'words' | 'phrases' | 'pronunciation' | 'listening' | 'speaking' | 'conversation' | 'review';
  /** Exercises per age band — the same lesson teaches different material to a 6- and a 14-year-old. */
  exercises: Record<ContentBand, Exercise[]>;
  guide?: { goal: string; goalHant: string; tip: string; tipHant: string; practice: string; practiceHant: string };
}

export interface Unit {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  lessons: Lesson[];
  locked?: boolean;
  /** Plainer names for teens and adults ("Food & Drink", not "Yummy Food"). */
  grownUp?: { title: string; subtitle: string };
}

export interface Course {
  id: string;
  title: string;
  /** For teens and adults: just the language. */
  grownUpTitle?: string;
  language: CourseId;
  units: Unit[];
}

// ---------- Pronunciation assessment (provider-neutral) ----------

export type WordErrorType = 'none' | 'mispronunciation' | 'omission' | 'insertion';

export interface PhonemeScore {
  phoneme: PhonemeId;
  score: number;
  /** What the learner most likely produced instead, when the provider (or our model) can tell. */
  heardAs?: PhonemeId;
}

export interface SyllableScore {
  text: string;
  score: number;
  /** Mandarin: one syllable per character, with its tone check. */
  zh?: ZhSyllable;
}

/** One Mandarin syllable as assessed: the scorer's view of the sounds plus our own pitch check of the tone. */
export interface ZhSyllable {
  char: string;
  /** Expected numbered pinyin with the citation tone, e.g. "shui3". */
  py: string;
  /** Tones a native speaker would use here after tone changes (你好 → ní hǎo). 5 = light tone, not checked. */
  accept: Tone[];
  /** A 3rd tone followed by more speech is said low, without the final rise. */
  lowThird: boolean;
  /** Said alone, at the end of a phrase, or mid-phrase — tones move further alone (for the tone picture). */
  context?: 'alone' | 'final' | 'mid';
  /** The speech scorer's 0–100 for this syllable. */
  soundScore: number;
  /** Tone measured from the child's pitch, when the pitch was clear enough to tell. */
  toneHeard?: Tone;
  /** 0–100 match between the measured and the expected tone; absent when the tone couldn't be measured. */
  toneScore?: number;
  /** The child's pitch across the syllable on the 1 (low) – 5 (high) scale, for the tone picture. */
  contour?: number[];
  /** What the syllable most likely sounded like instead, as numbered pinyin — measured, not guessed. */
  heardAs?: string;
}

export interface WordScore {
  word: string;
  score: number;
  errorType: WordErrorType;
  syllables: SyllableScore[];
  phonemes: PhonemeScore[];
  /** Where the word sits in the recording (ms), when the scorer reports it. */
  offsetMs?: number;
  durationMs?: number;
}

export interface Assessment {
  provider: string;
  referenceText: string;
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody?: number;
  words: WordScore[];
  durationMs: number;
}

export interface Attempt {
  id: string;
  profileId: string;
  itemId: string;
  text: string;
  createdAt: number;
  assessment: Assessment;
  /** Key into the audio store; undefined when the parent has turned recording storage off. */
  audioKey?: string;
  context: 'lesson' | 'lab' | 'practice' | 'onboarding' | 'test';
}

// ---------- Pronunciation intelligence ----------

export interface PhonemeStat {
  phoneme: PhonemeId;
  /** Exponential moving average of scores — recent attempts weigh more. */
  ema: number;
  first: number;
  best: number;
  count: number;
  lowCount: number;
  lastSeen: number;
  /** Number of distinct days this sound was practised — mastery must hold up across days, not within one sitting. */
  days: number;
  /** Most frequent substitution heard, e.g. θ → s. */
  heardAs: Record<PhonemeId, number>;
  masteredAt?: number;
}

export interface WordStat {
  word: string;
  best: number;
  last: number;
  attempts: number;
  retries: number;
  lastSeen: number;
}

export interface DayStat {
  date: string; // YYYY-MM-DD
  attempts: number;
  scoreSum: number;
  speakingMs: number;
  xp: number;
}

export interface PronunciationProfile {
  phonemes: Record<PhonemeId, PhonemeStat>;
  words: Record<string, WordStat>;
  days: Record<string, DayStat>;
  fluencyEma?: number;
  prosodyEma?: number;
}

// ---------- Learning engine ----------

export interface ItemProgress {
  itemId: string;
  text: string;
  best: number;
  mastered: boolean;
  /** Leitner box 0–4 for spaced repetition. */
  box: number;
  dueAt: number;
  attempts: number;
}

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  icon: string;
  earnedAt: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  avatar: string;
  age: number;
  band: AgeBand;
  homeLanguage: HomeLanguage;
  level: Level;
  goal: Goal;
  accent: Accent;
  /** Courses this learner takes, and the one on screen now. */
  learning: CourseId[];
  course: CourseId;
  /** Mandarin: which characters to show (the scorer always gets Simplified). */
  zhScript: 'hant' | 'hans';
  /** The learner's usual pitch in semitones re 100 Hz, learned from their takes; Mandarin tones are judged against it. */
  voice?: { median: number; spread?: number; takes: number };
  /** Set once the first Mandarin speaking check is done. */
  zhChecked?: boolean;
  createdAt: number;
  /** When a grown-up last changed who this learner is or how they learn (name, age, accent, courses…): with two devices, the later edit wins. */
  editedAt?: number;
  xp: number;
  dailyGoalXp: number;
  streak: { count: number; lastDay: string | null; best: number };
  lessonsCompleted: Record<string, { completedAt: number; stars: number; bestAvg: number }>;
  items: Record<string, ItemProgress>;
  pronunciation: PronunciationProfile;
  achievements: Achievement[];
  conversations: ConversationRecord[];
  /** Test mode (the same lesson without the teacher), by lesson id: the last score, the best, how many times. */
  tests?: Record<string, TestRecord>;
  /** The random name shown on leaderboards ("Brave Otter 42"), made once (engine/handles.ts). */
  handle?: string;
}

export interface TestRecord { at: number; score: number; best: number; taken: number }

export interface ConversationRecord {
  id: string;
  scenarioId: string;
  at: number;
  score: number;
  strong: string[];
  practice: PhonemeId[];
}

export interface ParentSettings {
  storeRecordings: boolean;
  /** Tongue-twister boards: a passing time goes up under the learner's nickname and avatar unless this is off. */
  shareScores?: boolean;
  /**
   * "Help improve Wunder Tutor": the server keeps practice recordings, with no name, to test and improve how
   * pronunciation is checked. On by default: ticked in setup (Leslie, 2026-09-21) and in a fresh install's settings
   * (2026-09-25, "enable consent by default"), always visible on the privacy page with a switch to turn it off. Only a
   * device set up before the switch existed has no value, and a missing value means NO: nobody is moved onto terms
   * they were never shown. The copies live in R2 for 90 days at most; deleting recordings or the learner forgets them.
   */
  contributeRecordings?: boolean;
  consentedAt: number | null;
  /** Dev/demo aid: simulate the microphone so the full flow works on devices without one. */
  demoMic: boolean;
  simulate: 'none' | 'network' | 'service' | 'slow';
  theme: 'auto' | 'light' | 'dark';
  /** The app's own wording (not what is being learned). Not chosen yet: the device's language decides. */
  language?: Language;
}
