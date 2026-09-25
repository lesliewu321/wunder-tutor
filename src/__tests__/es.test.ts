import { describe, expect, it } from 'vitest';
import { COURSES, ITEM_INDEX } from '../content/course';
import { ES_CHECK_ITEMS, ES_COURSE, ES_ITEMS, ES_LAB_SOUNDS, ES_LADDERS } from '../content/es/course';
import { esId } from '../content/es/item';
import { esAlignmentCandidates, esPhonemesIn } from '../content/es/lexicon';
import { ES_SOUNDS } from '../content/es/sounds';
import { LADDERS } from '../content/lab';
import { PHONEMES, phonemeInfo } from '../content/phonemes';
import { scenariosFor } from '../content/scenarios';
import { itemCourse, unitCourse } from '../engine/learning';
import { inCourse } from '../intelligence/profile';

// The Spanish course as the app runs it: registered, every item Spanish, every taught sound with a ladder, and every
// line's sounds readable from its spelling.

describe('the Spanish course', () => {
  it('is registered, with three age bands in every lesson', () => {
    expect(COURSES.es).toBe(ES_COURSE);
    expect(ES_COURSE.language).toBe('es');
    const lessons = ES_COURSE.units.flatMap((u) => u.lessons);
    expect(lessons.length).toBe(34);
    for (const l of lessons) for (const band of ['little', 'junior', 'teen'] as const) expect(l.exercises[band].length).toBeGreaterThan(0);
    expect(unitCourse(ES_COURSE.units[0].id)).toBe('es');
  });

  it('marks every item Spanish, with an id that is its text', () => {
    expect(ES_ITEMS.length).toBeGreaterThan(30);
    for (const it of ES_ITEMS) {
      expect(it.lang).toBe('es-ES');
      expect(itemCourse(it)).toBe('es');
      expect(ITEM_INDEX[it.id]).toBe(it);
      if (it.kind !== 'syllable') expect(it.id).toBe(esId(it.text));
      // Every line's sounds can be read from its spelling and lined up with a scorer's count.
      expect(esAlignmentCandidates(it.text.split(/\s+/)[0]).length).toBeGreaterThan(0);
    }
  });

  it('names the sounds an item says it practises — its focus is really in the line', () => {
    for (const it of ES_ITEMS) for (const f of it.focus ?? []) {
      if (f === 'es:vowel') continue; // every line has vowels
      expect(esPhonemesIn(it.text), `${it.text} claims ${f}`).toContain(f);
    }
  });

  it('teaches eight namespaced sounds, each with a ladder, none of them an English or French id', () => {
    expect(ES_SOUNDS.map((s) => s.id)).toEqual(['es:rr', 'es:r', 'es:j', 'es:ñ', 'es:z', 'es:b', 'es:ll', 'es:vowel']);
    expect(ES_LAB_SOUNDS).toEqual(ES_SOUNDS.map((s) => s.id));
    for (const id of ES_LAB_SOUNDS) {
      expect(PHONEMES[id]).toBeDefined();
      expect(ES_LADDERS[id]).toBeDefined();
      expect(LADDERS[id]).toBe(ES_LADDERS[id]);
      expect(inCourse(id, 'es')).toBe(true);
      expect(inCourse(id, 'en')).toBe(false);
      expect(inCourse(id, 'fr')).toBe(false);
      expect(phonemeInfo(id).tip?.little?.length ?? 0).toBeGreaterThan(10);
    }
    expect(inCourse('θ', 'es')).toBe(false);
    expect(inCourse('ɲ', 'es')).toBe(false);
  });

  it('checks a learner with a few lines per age band, and has three conversations', () => {
    for (const band of ['little', 'junior', 'teen'] as const) expect(ES_CHECK_ITEMS[band].length).toBeGreaterThanOrEqual(3);
    expect(scenariosFor('es').map((s) => s.id)).toEqual(['es-cafe', 'es-zoo', 'es-friend']);
    for (const s of scenariosFor('es')) for (const t of s.turns) for (const band of ['little', 'junior', 'teen'] as const) {
      expect(t.tutor[band].lang).toBe('es-ES');
      for (const r of t.replies[band]) expect(r.lang).toBe('es-ES');
    }
  });
});
