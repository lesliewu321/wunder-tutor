import fs from 'node:fs';
import { COURSES, courseFor } from '../src/content/course';
import { AGE_BANDS, lessonExercises, stageOf, topicOf } from './curriculum';
import { describe, it } from 'vitest';
describe.skipIf(!process.env.CURRICULUM_EXPORT)('curriculum manifest export', () => { it('writes all runtime paths', () => {
const paths = Object.values(COURSES).flatMap(course => AGE_BANDS.map(band => ({
  course: course.language, ageBand: band,
  units: courseFor(course.language, band).units.filter(u => !u.locked && u.lessons.length).map(unit => ({
    id: unit.id, topic: topicOf(unit.id), stage: stageOf(unit),
    lessons: unit.lessons.map(lesson => ({ id: lesson.id, title: lesson.title, kind: lesson.kind,
      exercises: lessonExercises(lesson, band).map(ex => ({ id: ex.id, type: ex.type })) })),
  })),
})));
fs.writeFileSync('astra-lessons/curriculum-manifest.json', JSON.stringify({ version: 1, stages: ['First words and patterns', 'Everyday conversations', 'Putting it together'], paths }, null, 2) + '\n');
console.log('Exported ' + paths.length + ' curriculum paths.');

}); });
