// Course additions authored and generated entirely in astra-lessons.
// Reuse existing item objects by stable ID so past progress and pronunciation metadata remain valid.
import type { Course, Exercise, SpeakItem } from '../src/domain/types';
import { buildCourse, type BuiltCourse, type CourseFile } from '../src/content/load';
import en from './courses/en-communication.json';
import zh from './courses/zh-communication.json';
import ja from './courses/ja-communication.json';
import ko from './courses/ko-communication.json';
import fr from './courses/fr-communication.json';
import es from './courses/es-communication.json';

export const COMMUNICATION = Object.fromEntries(
  Object.entries({en, zh, ja, ko, fr, es}).map(([lang, data]) =>
    [lang, buildCourse(data as unknown as CourseFile, 'astra-lessons/' + lang + '-communication')])
) as Record<Course['language'], BuiltCourse>;

const normal = (text: string) => text.normalize('NFC').replace(/[\s\p{P}]/gu, '').toLowerCase();
export function addCommunication(course: Course, existing: SpeakItem[]): { course: Course; items: SpeakItem[] } {
  const pack = COMMUNICATION[course.language];
  const byId = new Map(existing.map(item => [item.id, item]));
  for (const item of pack.items) {
    const previous = byId.get(item.id);
    if (previous && normal(previous.text) !== normal(item.text)) {
      throw new Error('Communication item would change existing text: ' + item.id);
    }
    if (!previous) byId.set(item.id, item);
  }
  const item = (it: SpeakItem) => byId.get(it.id)!;
  const exercise = (ex: Exercise): Exercise => {
    switch (ex.type) {
      case 'speak': case 'arrange': return {...ex, item: item(ex.item)};
      case 'choose-heard': return {...ex, answer: item(ex.answer), options: ex.options.map(item)};
      case 'minimal-pair': return {...ex, pair: [item(ex.pair[0]), item(ex.pair[1])]};
      case 'read-choice': return {...ex, passage: item(ex.passage), answer: item(ex.answer), options: ex.options.map(item)};
      case 'dialogue': return {...ex, ...(ex.tutor ? {tutor: item(ex.tutor)} : {}), replies: ex.replies.map(item)};
    }
  };
  const units = pack.course.units.map(unit => ({
    ...unit, lessons: unit.lessons.map(lesson => ({
      ...lesson, exercises: {
        little: lesson.exercises.little.map(exercise),
        junior: lesson.exercises.junior.map(exercise),
        teen: lesson.exercises.teen.map(exercise)
      }
    }))
  }));
  const replacements = new Map(units.map(unit => [unit.id, unit]));
  const used = new Set<string>();
  const retained = course.units.map(unit => {
    const replacement = replacements.get(unit.id);
    if (!replacement) return unit;
    if (unit.lessons.length || !unit.locked) throw new Error('Refusing to replace playable unit ' + unit.id);
    used.add(unit.id);
    return replacement;
  });
  // Keep playable existing units in order and put newly authored units before any remaining placeholders.
  const ready = retained.filter(unit => !unit.locked);
  const future = retained.filter(unit => unit.locked);
  return {course: {...course, units: [...ready, ...units.filter(unit => !used.has(unit.id)), ...future]}, items: [...byId.values()]};
}

export function addCommunicationToBuilt(base: BuiltCourse): BuiltCourse {
  const merged = addCommunication(base.course, base.items);
  const byId = Object.fromEntries(merged.items.map(item => [item.id, item]));
  const used = new Set([...base.lessonItems, ...COMMUNICATION[base.course.language].lessonItems].map(item => item.id));
  return {...base, ...merged, byId, lessonItems: [...used].map(id => byId[id])};
}
