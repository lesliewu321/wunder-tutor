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
export const settingsName = (band: AgeBand): string => (band === 'adult' ? 'Settings & privacy' : 'Parent Zone');
/** The English accent a child is taught. */
export type Accent = 'en-US' | 'en-GB';
/** What a piece of speech is scored and spoken as: English in the child's accent, or Mandarin (Putonghua). */
export type Locale = Accent | 'zh-CN';
export type CourseId = 'en' | 'zh';
/** Mandarin tone: 1–4, and 5 for the neutral (light) tone. */
export type Tone = 1 | 2 | 3 | 4 | 5;
/** 'yue' = Cantonese, 'zh' = Mandarin — their speakers make different mistakes in English, so they are kept apart. */
export type HomeLanguage = 'yue' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'hi' | 'ar' | 'other';
export type Level = 'new' | 'some' | 'confident';
export type Goal = 'school' | 'travel' | 'fun' | 'friends';

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
  /** Mandarin items are always Mandarin; everything else is English in the child's accent. */
  lang?: 'zh-CN';
  /** Mandarin items: `text` is Simplified (what the scorer is sent); this adds what the child reads. */
  zh?: ZhText;
}

export interface ZhText {
  /** Traditional characters, as read in Hong Kong. */
  hant: string;
  /** Numbered pinyin with citation tones, one syllable per character: "wo3 xiang3 he1 shui3". */
  py: string;
}

export type Exercise =
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
  context: 'lesson' | 'lab' | 'practice' | 'onboarding';
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
  xp: number;
  dailyGoalXp: number;
  streak: { count: number; lastDay: string | null; best: number };
  lessonsCompleted: Record<string, { completedAt: number; stars: number; bestAvg: number }>;
  items: Record<string, ItemProgress>;
  pronunciation: PronunciationProfile;
  achievements: Achievement[];
  conversations: ConversationRecord[];
}

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
  consentedAt: number | null;
  /** Dev/demo aid: simulate the microphone so the full flow works on devices without one. */
  demoMic: boolean;
  simulate: 'none' | 'network' | 'service' | 'slow';
  theme: 'auto' | 'light' | 'dark';
}
