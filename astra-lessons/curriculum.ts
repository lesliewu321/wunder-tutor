import type { AgeBand, Course, Exercise, Lesson, Unit } from '../src/domain/types';
import { contentBand } from '../src/domain/types';
import { tc } from '../src/i18n';

export const AGE_BANDS: AgeBand[] = ['little', 'junior', 'teen', 'adult'];
/** Topic prerequisites, not a claim of CEFR attainment. All bands start with foundations. */
export const FOUNDATION_ORDER: Record<AgeBand, string[]> = {
  little: ['greetings', 'numbers', 'family', 'home', 'school', 'animals', 'food', 'weather', 'feelings', 'routines', 'hobbies'],
  junior: ['greetings', 'numbers', 'family', 'home', 'school', 'food', 'animals', 'weather', 'feelings', 'routines', 'hobbies'],
  teen: ['greetings', 'numbers', 'family', 'home', 'school', 'routines', 'food', 'animals', 'weather', 'feelings', 'hobbies'],
  adult: ['greetings', 'numbers', 'family', 'home', 'food', 'routines', 'school', 'animals', 'weather', 'feelings', 'hobbies'],
};
const EVERYDAY = ['people', 'town', 'shopping', 'travel', 'out'];
const APPLIED = ['stories', 'plans', 'work'];
export type Stage = 1 | 2 | 3;
export const topicOf = (unitId: string): string => unitId.replace(/^(zh|fr|ja|ko|es)-/, '');
export const stageOf = (unit: Pick<Unit, 'id'>): Stage => APPLIED.includes(topicOf(unit.id)) ? 3 : EVERYDAY.includes(topicOf(unit.id)) ? 2 : 1;
const STAGES = { 1: '1 · First words and patterns', 2: '2 · Everyday conversations', 3: '3 · Putting it together' };
export const stageLabel = (unit: Pick<Unit, 'id'>): string => tc('curriculum.stage.' + stageOf(unit), STAGES[stageOf(unit)]);
export const AGE_GUIDANCE: Record<AgeBand, string> = {
  little: 'Little · Ages 5–7: point, listen and say short phrases. Try a pretend conversation with a trusted adult.',
  junior: 'Junior · Ages 8–11: build short sentences, find details and practise a conversation with a partner.',
  teen: 'Teen · Ages 12–17: connect ideas and give clear replies. Use school, friendship and team-project situations.',
  adult: 'Adult · Ages 18+: start with a short foundation task, then extend your replies for everyday life, travel and work.',
};
export const ageGuidance = (band: AgeBand): string => tc('curriculum.age.' + band, AGE_GUIDANCE[band]);

// Deduplicate by task content, not exercise id: the original authoring gives identical words a new id in each band.
const signature = (ex: Exercise): string => JSON.stringify({ ...ex, id: undefined });
export function adultExercises(lesson: Lesson): Exercise[] {
  const warmup = lesson.exercises.junior.slice(0, lesson.kind === 'words' ? 0 : 1);
  const seen = new Set<string>();
  return [...warmup, ...lesson.exercises.teen].filter(ex => {
    const key = signature(ex); if (seen.has(key)) return false; seen.add(key); return true;
  });
}
/** Explicit four-band plans; legacy/seasonal lessons retain their original fallback. */
export const lessonExercises = (lesson: Lesson, band: AgeBand): Exercise[] =>
  band === 'adult' ? lesson.exercises.adult ?? adultExercises(lesson) : lesson.exercises[band];

export function mergeCurriculum(course: Course, band: AgeBand): Course {
  const topics = [...FOUNDATION_ORDER[band], 'cafe', ...EVERYDAY, ...APPLIED];
  const rank = (u: Unit) => { const i = topics.indexOf(topicOf(u.id)); return i < 0 ? topics.length : i; };
  const ordered = [...course.units].sort((a, b) => Number(!!a.locked) - Number(!!b.locked) || rank(a) - rank(b));
  const earlierWords: Exercise[] = [];
  const units = ordered.map(unit => {
    const lessons = unit.lessons.map(lesson => {
      const exercises = { ...lesson.exercises, adult: adultExercises(lesson) };
      // Teens practise project teamwork here; adult workplace dialogues are a separate edition.
      if (topicOf(unit.id) === 'work') exercises.teen = lesson.exercises.junior;
      const selected = band === 'adult' ? exercises.adult : exercises[contentBand(band)];
      // Foundation reviews used a word from the old file order. Recall only words introduced on this path.
      const taughtHere = new Set(unit.lessons.filter(l => l.kind !== 'review').flatMap(l => lessonExercises(l, band))
        .filter((ex): ex is Extract<Exercise, { type: 'speak' }> => ex.type === 'speak')
        .map(ex => ex.item.id));
      const revised = lesson.kind === 'review' && ['en', 'zh'].includes(course.language) && FOUNDATION_ORDER[band].includes(topicOf(unit.id)) && topicOf(unit.id) !== 'food' ? selected.map(ex => {
        if (ex.type !== 'speak' || taughtHere.has(ex.item.id)) return ex;
        const earlier = earlierWords[earlierWords.length - 1];
        return earlier?.type === 'speak' ? { ...ex, item: earlier.item } : ex;
      }) : selected;
      exercises[band] = revised;
      return { ...lesson, exercises };
    });
    for (const lesson of lessons.filter(l => l.kind === 'words')) earlierWords.push(...lessonExercises(lesson, band).filter(ex => ex.type === 'speak'));
    return { ...unit, lessons };
  });
  return { ...course, units };
}
