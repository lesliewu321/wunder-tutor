import { readFileSync, writeFileSync } from 'node:fs';
import { COURSES, lessonsOf } from '../../src/content/course';
import { scenariosFor } from '../../src/content/scenarios';
import { LANGUAGES } from '../../src/i18n';
import { TEACHER_VOICE_DEFAULTS } from '../../src/speech/teacherVoiceDefaults';
import type { AgeBand, CourseId } from '../../src/domain/types';
const order: CourseId[] = ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'];
if (order.length !== Object.keys(COURSES).length) throw new Error('Update the website for the new course.');
const names: Record<CourseId, string> = { en: 'English', zh: 'Putonghua (Mandarin)', yue: 'Cantonese', ja: 'Japanese', ko: 'Korean', fr: 'French', es: 'Spanish' };
const courses = order.map(id => {
  const counts = (['little', 'junior', 'teen', 'adult'] as AgeBand[]).map(band => lessonsOf(id, band).length);
  if (new Set(counts).size !== 1) throw new Error('Review age-specific lesson counts for ' + id);
  return { id, name: names[id], lessons: counts[0], conversations: scenariosFor(id).length, voices: TEACHER_VOICE_DEFAULTS[id] };
});
const facts = { courses, totalLessons: courses.reduce((n, c) => n + c.lessons, 0), languages: LANGUAGES.map(({ id, label }) => ({ id, label })) };
const destination = new URL('../src/lib/app-facts.json', import.meta.url);
const content = JSON.stringify(facts, null, 2) + '\n';
if (process.argv.includes('--write')) {
  writeFileSync(destination, content);
  console.log('Updated website facts: ' + courses.length + ' courses, ' + facts.totalLessons + ' lessons.');
} else {
  if (readFileSync(destination, 'utf8') !== content) throw new Error('Website facts differ from the app. Run npm run content:sync in site/, review the copy, then rebuild.');
  console.log('Website course counts, interface languages and voice defaults match the app.');
}
