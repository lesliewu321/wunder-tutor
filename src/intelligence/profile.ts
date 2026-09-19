import type { Assessment, HomeLanguage, PhonemeId, PhonemeStat, PronunciationProfile } from '../domain/types';
import { LAB_SOUNDS, phonemeInfo } from '../content/phonemes';
import { wordKey } from '../content/lexicon';

// Pronunciation Intelligence: the persistent memory of how this child pronounces English.
// Pure functions over PronunciationProfile so they can run on-device today and server-side later.

const ALPHA = 0.3;
export const WEAK_BELOW = 78;
export const MASTERED_AT = 88;
const MASTERED_MIN_COUNT = 6;
const MASTERED_MIN_DAYS = 2;

export const emptyProfile = (): PronunciationProfile => ({ phonemes: {}, words: {}, days: {} });

export const dayKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface ProfileEvents {
  soundsMastered: PhonemeId[];
  personalBest?: { word: string; score: number; previous: number };
}

export const applyAssessment = (
  profile: PronunciationProfile, a: Assessment, now: number, isRetry: boolean,
): { profile: PronunciationProfile; events: ProfileEvents } => {
  const phonemes = { ...profile.phonemes };
  const words = { ...profile.words };
  const events: ProfileEvents = { soundsMastered: [] };

  // One observation per phoneme per attempt (its lowest score), so a long sentence doesn't swamp the average.
  const seen = new Map<PhonemeId, { score: number; heardAs?: PhonemeId }>();
  for (const w of a.words) {
    for (const p of w.phonemes) {
      if (!p.phoneme) continue; // unnamed by the scorer and not alignable — nothing to remember
      const cur = seen.get(p.phoneme);
      if (!cur || p.score < cur.score) seen.set(p.phoneme, { score: p.score, heardAs: p.heardAs });
    }
  }
  for (const [id, obs] of seen) {
    const prev = phonemes[id];
    const stat: PhonemeStat = prev
      ? { ...prev, heardAs: { ...prev.heardAs } }
      : { phoneme: id, ema: obs.score, first: obs.score, best: obs.score, count: 0, lowCount: 0, lastSeen: now, days: 0, heardAs: {} };
    stat.ema = prev ? prev.ema * (1 - ALPHA) + obs.score * ALPHA : obs.score;
    stat.best = Math.max(stat.best, obs.score);
    stat.count += 1;
    if (!prev || dayKey(prev.lastSeen) !== dayKey(now)) stat.days = (stat.days ?? 0) + 1;
    stat.lastSeen = now;
    if (obs.score < WEAK_BELOW) stat.lowCount += 1;
    if (obs.heardAs) stat.heardAs[obs.heardAs] = (stat.heardAs[obs.heardAs] ?? 0) + 1;
    if (!stat.masteredAt && stat.count >= MASTERED_MIN_COUNT && (stat.days ?? 0) >= MASTERED_MIN_DAYS && stat.ema >= MASTERED_AT && phonemeInfo(id).difficulty >= 0.3) {
      stat.masteredAt = now;
      events.soundsMastered.push(id);
    } else if (stat.masteredAt && stat.ema < WEAK_BELOW) {
      stat.masteredAt = undefined; // slipped — it comes back into practice
    }
    phonemes[id] = stat;
  }

  for (const w of a.words) {
    if (w.errorType === 'insertion' || !w.phonemes.length) continue;
    const key = wordKey(w.word);
    const prev = words[key];
    if (prev && prev.attempts >= 1 && w.score > prev.best && w.score >= 90 && a.words.length === 1) {
      events.personalBest = { word: w.word, score: w.score, previous: prev.best };
    }
    words[key] = {
      word: key, best: Math.max(prev?.best ?? 0, w.score), last: w.score,
      attempts: (prev?.attempts ?? 0) + 1, retries: (prev?.retries ?? 0) + (isRetry ? 1 : 0), lastSeen: now,
    };
  }

  const dk = dayKey(now);
  const day = profile.days[dk] ?? { date: dk, attempts: 0, scoreSum: 0, speakingMs: 0, xp: 0 };
  const days = { ...profile.days, [dk]: { ...day, attempts: day.attempts + 1, scoreSum: day.scoreSum + a.overall, speakingMs: day.speakingMs + a.durationMs } };

  const ema = (prev: number | undefined, v: number | undefined) => (v == null ? prev : prev == null ? v : prev * (1 - ALPHA) + v * ALPHA);
  return {
    profile: { phonemes, words, days, fluencyEma: ema(profile.fluencyEma, a.fluency), prosodyEma: ema(profile.prosodyEma, a.prosody) },
    events,
  };
};

const teachable = (s: PhonemeStat) => phonemeInfo(s.phoneme).difficulty >= 0.3;

/** Recurring trouble: seen at least twice and still averaging low. Worst first. */
export const weakSounds = (p: PronunciationProfile): PhonemeStat[] =>
  Object.values(p.phonemes).filter((s) => s.count >= 2 && s.ema < WEAK_BELOW).sort((a, b) => a.ema - b.ema);

export const masteredSounds = (p: PronunciationProfile): PhonemeStat[] =>
  Object.values(p.phonemes).filter((s) => s.masteredAt && teachable(s)).sort((a, b) => (b.masteredAt ?? 0) - (a.masteredAt ?? 0));

export const improvingSounds = (p: PronunciationProfile): (PhonemeStat & { gain: number })[] =>
  Object.values(p.phonemes).filter((s) => s.count >= 3 && teachable(s)).map((s) => ({ ...s, gain: Math.round(s.ema - s.first) }))
    .filter((s) => s.gain >= 5).sort((a, b) => b.gain - a.gain);

/** Before we have data, predict trouble from the home language so day one is already personalised. */
export const predictedTrouble = (home: HomeLanguage): PhonemeId[] =>
  [...LAB_SOUNDS].sort((a, b) => {
    const d = (id: PhonemeId) => phonemeInfo(id).difficulty + (phonemeInfo(id).l1?.[home]?.boost ?? 0);
    return d(b) - d(a);
  });

/** Lab ordering: measured weak sounds first, then predicted trouble, mastered last. */
export const labOrder = (p: PronunciationProfile, home: HomeLanguage): PhonemeId[] => {
  const weak = weakSounds(p).map((s) => s.phoneme).filter((id) => LAB_SOUNDS.includes(id));
  const mastered = new Set(masteredSounds(p).map((s) => s.phoneme));
  const rest = predictedTrouble(home).filter((id) => !weak.includes(id));
  return [...weak, ...rest.filter((id) => !mastered.has(id)), ...rest.filter((id) => mastered.has(id))];
};

/** Today's recommended focus sound. */
export const focusSound = (p: PronunciationProfile, home: HomeLanguage): PhonemeId => labOrder(p, home)[0];

export interface TrendPoint { date: string; avg: number; attempts: number }

export const trend = (p: PronunciationProfile, days = 30, now = Date.now()): TrendPoint[] => {
  const cutoff = dayKey(now - days * 86400000);
  return Object.values(p.days).filter((d) => d.attempts > 0 && d.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, avg: Math.round(d.scoreSum / d.attempts), attempts: d.attempts }));
};

/** "67 → 84 this month": first vs latest active day within the window, once there are two days of data. */
export const improvementSummary = (p: PronunciationProfile, now = Date.now()): { from: number; to: number } | null => {
  const t = trend(p, 30, now);
  if (t.length < 2) return null;
  return { from: t[0].avg, to: t[t.length - 1].avg };
};

export const totals = (p: PronunciationProfile) => {
  const days = Object.values(p.days);
  return {
    speakingMs: days.reduce((n, d) => n + d.speakingMs, 0),
    attempts: days.reduce((n, d) => n + d.attempts, 0),
    wordsLearned: Object.values(p.words).filter((w) => w.best >= 80 && w.word.length > 2).length,
  };
};
