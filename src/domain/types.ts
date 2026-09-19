// Core domain types shared by every layer (content, speech, engine, UI).
// These mirror the tables in supabase/schema.sql so the local repository can
// later be swapped for a Supabase-backed one without touching the UI.

export type AgeBand = 'little' | 'junior' | 'teen';
export type Accent = 'en-US' | 'en-GB';
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
}

export type Exercise =
  | { id: string; type: 'speak'; item: SpeakItem; prompt?: 'text' | 'image' | 'translation' }
  | { id: string; type: 'choose-heard'; answer: SpeakItem; options: SpeakItem[] }
  | { id: string; type: 'minimal-pair'; pair: [SpeakItem, SpeakItem]; answerIndex: 0 | 1; focus: PhonemeId }
  | { id: string; type: 'dialogue'; tutorLine: string; replies: SpeakItem[]; picture?: string };

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  icon: string;
  kind: 'words' | 'phrases' | 'pronunciation' | 'listening' | 'speaking' | 'conversation' | 'review';
  /** Exercises per age band — the same lesson teaches different material to a 6- and a 14-year-old. */
  exercises: Record<AgeBand, Exercise[]>;
}

export interface Unit {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  lessons: Lesson[];
  locked?: boolean;
}

export interface Course {
  id: string;
  title: string;
  language: 'en';
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
}

export interface WordScore {
  word: string;
  score: number;
  errorType: WordErrorType;
  syllables: SyllableScore[];
  phonemes: PhonemeScore[];
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
