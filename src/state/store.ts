import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Accent, Achievement, AgeBand, Assessment, Attempt, ChildProfile, ConversationRecord, CourseId, Goal, HomeLanguage, Level, ParentSettings, PhonemeId, SpeakItem, TestRecord,
} from '../domain/types';
import { audioRepo, stateStorage } from '../data/repository';
import { applyAssessment, dayKey, emptyProfile } from '../intelligence/profile';
import { nextItemProgress, starsFor } from '../engine/learning';
import { achievement, bumpStreak, XP } from '../engine/rewards';
import { ALL_LESSONS } from '../content/course';
import { setDisplayScript } from '../content/zh/script';
import { deviceLanguage, setLanguage } from '../i18n';
import { nextVoice } from '../speech/pitch';
import { forgetBook, forgetScores } from '../features/say/page';
import { forgetSync, noteLearnerDeleted } from '../account/pending';

/** Little 5–7, Junior 8–11, Teen 12–17, Grown-up 18+. */
export const bandForAge = (age: number): AgeBand => (age <= 7 ? 'little' : age <= 11 ? 'junior' : age <= 17 ? 'teen' : 'adult');

export interface NewProfileInput {
  name: string; avatar: string; age: number; homeLanguage: HomeLanguage; level: Level; goal: Goal; accent: Accent;
  learning?: CourseId[]; zhScript?: 'hant' | 'hans';
}

export interface AttemptOutcome {
  attempt: Attempt;
  soundsMastered: PhonemeId[];
  personalBest?: { word: string; score: number; previous: number };
  achievements: Achievement[];
}

export interface LessonOutcome { stars: number; xp: number; achievements: Achievement[]; firstTime: boolean }

interface AppState {
  profiles: Record<string, ChildProfile>;
  activeId: string | null;
  settings: ParentSettings;
  attempts: Attempt[];

  createProfile(input: NewProfileInput): string;
  setActive(id: string): void;
  patchProfile(id: string, patch: Partial<ChildProfile>): void;
  setSettings(patch: Partial<ParentSettings>): void;
  recordAttempt(input: { item: SpeakItem; assessment: Assessment; audio?: Blob; context: Attempt['context']; isRetry: boolean; previousScore?: number; voice?: { median: number; spread: number } | null }): Promise<AttemptOutcome>;
  setCourse(course: CourseId): void;
  finishItem(item: SpeakItem, best: number, mastered: boolean, tries: number): void;
  completeLesson(lessonId: string, avgScore: number): LessonOutcome;
  /** Test mode: the same lesson without the teacher, one go per item. Records the score; the lesson itself stays as it was. */
  completeTest(lessonId: string, score: number): TestRecord;
  recordConversation(rec: Omit<ConversationRecord, 'id' | 'at'>): Achievement[];
  award(id: string): Achievement | null;
  addXp(amount: number): void;
  deleteRecordings(profileId?: string): Promise<number>;
  deletePronunciationHistory(profileId: string): Promise<void>;
  /** `heardFromAccount`: the family deleted this learner on another device (so the account need not be told). */
  deleteProfile(profileId: string, opts?: { heardFromAccount?: boolean }): Promise<void>;
  deleteEverything(): Promise<void>;
}

// contributeRecordings is on by default (Leslie, 2026-09-25: "enable consent by default"); setup shows the switch and a
// parent can turn it off there or in Settings. A device set up before the switch existed keeps a missing value = no.
const defaultSettings: ParentSettings = { storeRecordings: true, contributeRecordings: true, consentedAt: null, demoMic: false, simulate: 'none', theme: 'auto' };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const MAX_ATTEMPTS = 500;
const KEEP_AUDIO_PER_ITEM = 3;

const withXp = (p: ChildProfile, amount: number, now: number): ChildProfile => {
  const dk = dayKey(now);
  const day = p.pronunciation.days[dk] ?? { date: dk, attempts: 0, scoreSum: 0, speakingMs: 0, xp: 0 };
  return { ...p, xp: p.xp + amount, pronunciation: { ...p.pronunciation, days: { ...p.pronunciation.days, [dk]: { ...day, xp: day.xp + amount } } } };
};

const grant = (p: ChildProfile, ids: string[], now: number): { profile: ChildProfile; earned: Achievement[] } => {
  const earned = ids.filter((id) => !p.achievements.some((a) => a.id === id)).map((id) => achievement(id, now));
  return { profile: earned.length ? { ...p, achievements: [...p.achievements, ...earned] } : p, earned };
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      profiles: {},
      activeId: null,
      settings: defaultSettings,
      attempts: [],

      createProfile(input) {
        const id = uid();
        const learning: CourseId[] = input.learning?.length ? input.learning : ['en'];
        const profile: ChildProfile = {
          id, ...input, learning, course: learning[0], zhScript: input.zhScript ?? 'hant',
          band: bandForAge(input.age), createdAt: Date.now(), xp: 0, dailyGoalXp: 60,
          streak: { count: 0, lastDay: null, best: 0 }, lessonsCompleted: {}, items: {}, pronunciation: emptyProfile(), achievements: [], conversations: [],
        };
        set((s) => ({ profiles: { ...s.profiles, [id]: profile }, activeId: id }));
        return id;
      },

      setActive: (id) => set({ activeId: id }),
      patchProfile: (id, patch) => set((s) => (s.profiles[id] ? { profiles: { ...s.profiles, [id]: { ...s.profiles[id], ...patch, editedAt: Date.now() } } } : s)),
      setCourse: (course) => set((s) => {
        const p = s.profiles[s.activeId ?? ''];
        if (!p) return s;
        const learning = p.learning.includes(course) ? p.learning : [...p.learning, course];
        return { profiles: { ...s.profiles, [p.id]: { ...p, course, learning, editedAt: Date.now() } } };
      }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      async recordAttempt({ item, assessment, audio, context, isRetry, previousScore, voice }) {
        const s = get();
        const p = s.profiles[s.activeId ?? ''];
        if (!p) throw new Error('no active profile');
        const now = Date.now();
        const id = uid();

        let audioKey: string | undefined;
        if (audio && s.settings.storeRecordings) {
          audioKey = `${p.id}/${item.id}/${id}`;
          await audioRepo.save(audioKey, audio);
        }
        const attempt: Attempt = { id, profileId: p.id, itemId: item.id, text: item.text, createdAt: now, assessment, audioKey, context };

        const { profile: pron, events } = applyAssessment(p.pronunciation, assessment, now, isRetry);
        let next: ChildProfile = withXp({ ...p, pronunciation: pron, streak: bumpStreak(p.streak, now), voice: nextVoice(p.voice, voice) }, XP.attempt, now);

        const ids = ['first-word', ...events.soundsMastered.map((ph) => `sound-${ph}`)];
        if (assessment.overall >= 98) ids.push('perfect');
        if (previousScore != null && assessment.overall - previousScore >= 15) ids.push('comeback');
        if (next.streak.count >= 3) ids.push('streak-3');
        if (next.streak.count >= 7) ids.push('streak-7');
        const granted = grant(next, ids, now);
        next = granted.profile;

        // Keep only the newest few recordings per item; metrics are kept regardless.
        const attempts = [...s.attempts, attempt];
        const sameItem = attempts.filter((a) => a.profileId === p.id && a.itemId === item.id && a.audioKey);
        const stale = sameItem.slice(0, Math.max(0, sameItem.length - KEEP_AUDIO_PER_ITEM));
        if (stale.length) {
          await audioRepo.remove(stale.map((a) => a.audioKey!));
          const staleIds = new Set(stale.map((a) => a.id));
          attempts.forEach((a, i) => { if (staleIds.has(a.id)) attempts[i] = { ...a, audioKey: undefined }; });
        }

        set((st) => ({ profiles: { ...st.profiles, [p.id]: next }, attempts: attempts.slice(-MAX_ATTEMPTS) }));
        return { attempt, soundsMastered: events.soundsMastered, personalBest: events.personalBest, achievements: granted.earned };
      },

      finishItem(item, best, mastered, tries) {
        set((s) => {
          const p = s.profiles[s.activeId ?? ''];
          if (!p) return s;
          const now = Date.now();
          const gained = (mastered ? XP.mastered : 0) + (mastered && tries === 1 ? XP.firstTry : 0);
          const next = withXp({ ...p, items: { ...p.items, [item.id]: nextItemProgress(p.items[item.id], item, best, mastered, tries, now) } }, gained, now);
          return { profiles: { ...s.profiles, [p.id]: next } };
        });
      },

      completeLesson(lessonId, avgScore) {
        const s = get();
        const p = s.profiles[s.activeId ?? ''];
        if (!p) return { stars: 1, xp: 0, achievements: [], firstTime: false };
        const now = Date.now();
        const stars = starsFor(avgScore);
        const prev = p.lessonsCompleted[lessonId];
        let next: ChildProfile = {
          ...p,
          lessonsCompleted: { ...p.lessonsCompleted, [lessonId]: { completedAt: now, stars: Math.max(stars, prev?.stars ?? 0), bestAvg: Math.max(avgScore, prev?.bestAvg ?? 0) } },
        };
        next = withXp(next, XP.lesson, now);
        const ids = ['first-lesson'];
        const unit = ALL_LESSONS.find((l) => l.id === lessonId)?.unitId;
        if (unit && ALL_LESSONS.filter((l) => l.unitId === unit).every((l) => next.lessonsCompleted[l.id])) ids.push(`unit-${unit}`);
        const granted = grant(next, ids, now);
        set((st) => ({ profiles: { ...st.profiles, [p.id]: granted.profile } }));
        return { stars, xp: XP.lesson, achievements: granted.earned, firstTime: !prev };
      },

      completeTest(lessonId, score) {
        const s = get();
        const p = s.profiles[s.activeId ?? ''];
        const now = Date.now();
        const prev = p?.tests?.[lessonId];
        const rec: TestRecord = { at: now, score, best: Math.max(score, prev?.best ?? 0), taken: (prev?.taken ?? 0) + 1 };
        if (p) set((st) => ({ profiles: { ...st.profiles, [p.id]: { ...p, tests: { ...p.tests, [lessonId]: rec } } } }));
        return rec;
      },

      recordConversation(rec) {
        const s = get();
        const p = s.profiles[s.activeId ?? ''];
        if (!p) return [];
        const now = Date.now();
        const next = withXp({ ...p, conversations: [...p.conversations, { ...rec, id: uid(), at: now }].slice(-50) }, XP.conversation, now);
        const granted = grant(next, ['chatterbox'], now);
        set((st) => ({ profiles: { ...st.profiles, [p.id]: granted.profile } }));
        return granted.earned;
      },

      award(id) {
        const s = get();
        const p = s.profiles[s.activeId ?? ''];
        if (!p) return null;
        const granted = grant(p, [id], Date.now());
        if (granted.earned.length) set((st) => ({ profiles: { ...st.profiles, [p.id]: granted.profile } }));
        return granted.earned[0] ?? null;
      },

      addXp(amount) {
        set((s) => {
          const p = s.profiles[s.activeId ?? ''];
          return p ? { profiles: { ...s.profiles, [p.id]: withXp(p, amount, Date.now()) } } : s;
        });
      },

      async deleteRecordings(profileId) {
        const removed = await audioRepo.clear(profileId ? `${profileId}/` : '');
        set((s) => ({ attempts: s.attempts.map((a) => (!profileId || a.profileId === profileId ? { ...a, audioKey: undefined } : a)) }));
        return removed;
      },

      async deletePronunciationHistory(profileId) {
        await audioRepo.clear(`${profileId}/`);
        forgetScores(profileId); // the pages of My book stay, like completed lessons
        set((s) => {
          const p = s.profiles[profileId];
          if (!p) return s;
          return {
            attempts: s.attempts.filter((a) => a.profileId !== profileId),
            profiles: { ...s.profiles, [profileId]: { ...p, pronunciation: emptyProfile(), items: {}, conversations: [] } },
          };
        });
      },

      async deleteProfile(profileId, opts) {
        await audioRepo.clear(`${profileId}/`);
        forgetBook(profileId);
        if (!opts?.heardFromAccount) noteLearnerDeleted(profileId);
        set((s) => {
          const { [profileId]: _gone, ...rest } = s.profiles;
          const ids = Object.keys(rest);
          return { profiles: rest, attempts: s.attempts.filter((a) => a.profileId !== profileId), activeId: s.activeId === profileId ? ids[0] ?? null : s.activeId };
        });
      },

      async deleteEverything() {
        await audioRepo.clear('');
        Object.keys(get().profiles).forEach(forgetBook);
        forgetSync();
        set({ profiles: {}, activeId: null, attempts: [], settings: defaultSettings });
      },
    }),
    {
      name: 'wunder-tutor/v1',
      version: 2,
      storage: createJSONStorage(() => stateStorage),
      partialize: ({ profiles, activeId, settings, attempts }) => ({ profiles, activeId, settings, attempts }),
      // v1 → v2: learners gain courses (English / Mandarin) and a character-set choice.
      migrate: (state, version) => {
        const s = state as { profiles?: Record<string, ChildProfile> };
        if (version < 2 && s.profiles) {
          for (const p of Object.values(s.profiles)) {
            p.learning ??= ['en'];
            p.course ??= 'en';
            p.zhScript ??= 'hant';
          }
        }
        return state as AppState;
      },
    },
  ),
);

// Mandarin guide copy follows the active learner's script. This listener is registered before any component's, so
// the script is current by the time React re-renders.
const syncScript = (s: AppState) => setDisplayScript(s.profiles[s.activeId ?? '']?.zhScript ?? 'hant');
syncScript(useStore.getState());
useStore.subscribe(syncScript);

// The app's wording follows the App language setting the same way (wording outside React reads it from src/i18n).
const syncLanguage = (s: AppState) => setLanguage(s.settings.language ?? deviceLanguage());
syncLanguage(useStore.getState());
useStore.subscribe(syncLanguage);

export const useProfile = (): ChildProfile | null => useStore((s) => (s.activeId ? s.profiles[s.activeId] ?? null : null));

/** For screens that only render behind the onboarding guard. */
export const useActiveProfile = (): ChildProfile => {
  const p = useProfile();
  if (!p) throw new Error('No active profile');
  return p;
};
