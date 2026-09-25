import type { ContentBand, Course, CourseId, Exercise, HomeLanguage, Lesson, PhonemeId, SpeakItem, Unit } from '../domain/types';
import { zhItem } from './zh/item';

// The loader: the one place the engine turns a course DATA file (content/courses/<language>.json) into the objects it
// runs on. The engine knows the shape of a course, never a course — every course, unit, lesson, item, check and Lab
// ladder comes from a data file through here, and nothing under src/ reads content any other way.
//
// The files are checked as they are read: an exercise that names an item the file does not have, a listening
// exercise with nothing to choose between, a lesson missing an age band — each is an error with the file and the
// place in it, at build time (scripts/content-check.ts) and in the tests, never a blank screen for a learner.
//
// Ids are written in the files, not derived here, because a learner's progress is keyed by them (lesson ids in
// `lessonsCompleted`, item ids in the pronunciation profile and the review schedule). A file that omits an item's
// `kind` gets it derived the way the hand-written courses used to derive it.

export const BANDS: readonly ContentBand[] = ['little', 'junior', 'teen'];
export type LabStage = 'syllables' | 'words' | 'phrases' | 'sentence';
export const LAB_STAGES: readonly LabStage[] = ['syllables', 'words', 'phrases', 'sentence'];
export type Ladder = Record<LabStage, SpeakItem[]>;

/** An item as written in a data file: everything but its id, which is the key. */
export interface ItemData {
  text: string;
  say?: string;
  picture?: string;
  meaning?: string;
  kind?: SpeakItem['kind'];
  focus?: PhonemeId[];
  lang?: SpeakItem['lang'];
  zh?: SpeakItem['zh'];
  ja?: SpeakItem['ja'];
  translations?: Partial<Record<HomeLanguage, string>>;
}

export type ExerciseData =
  | { type: 'read-choice'; passage: string; question: string; questionHant: string; answer: string; others: string[]; explanation: string; explanationHant: string }
  | { type: 'arrange'; item: string; chunks: string[]; chunksHant?: string[] }
  | { type: 'speak'; item: string; prompt?: 'text' | 'image' | 'translation' }
  | { type: 'choose-heard'; answer: string; others: string[] }
  | { type: 'minimal-pair'; pair: [string, string]; answer: 0 | 1; focus: PhonemeId }
  | { type: 'dialogue'; line?: string; tutor?: string; picture?: string; replies: string[] };

export interface LessonData { id: string; title: string; icon: string; kind: Lesson['kind']; exercises: Record<ContentBand, ExerciseData[]>; guide?: Lesson['guide'] }
export interface UnitData { id: string; title: string; subtitle: string; icon: string; color: string; grownUp?: Unit['grownUp']; locked?: boolean; lessons: LessonData[] }

export interface CourseFile {
  id: string;
  language: CourseId;
  title: string;
  grownUpTitle?: string;
  /** Exercise ids are `<prefix>-<n>`, numbered through the file in lesson, band, exercise order. */
  exercisePrefix: string;
  items: Record<string, ItemData>;
  units: UnitData[];
  /** The speaking check the first time this course is opened, by age band. */
  check: Record<ContentBand, string[]>;
  lab: { sounds?: PhonemeId[]; ladders: Record<PhonemeId, Record<LabStage, string[]>> };
}

export interface BuiltCourse {
  course: Course;
  /** Every item in the file, in the file's order. */
  items: SpeakItem[];
  byId: Record<string, SpeakItem>;
  /** The items a lesson uses (what the item index and the review engine know about). */
  lessonItems: SpeakItem[];
  check: Record<ContentBand, SpeakItem[]>;
  labSounds: PhonemeId[];
  ladders: Record<PhonemeId, Ladder>;
}

export class ContentError extends Error {
  constructor(file: string, where: string, problem: string) { super(`${file}: ${where}: ${problem}`); }
}

const HAN = /\p{Script=Han}/u;

/** The kind of an English line, as the hand-written course decided it. */
export const kindOfText = (text: string): SpeakItem['kind'] => {
  const words = text.trim().split(/\s+/).length;
  if (words === 1) return 'word';
  return /[.?!]$/.test(text.trim()) && words > 3 ? 'sentence' : 'phrase';
};

function buildItem(file: string, id: string, d: ItemData): SpeakItem {
  const where = `item ${id}`;
  if (typeof d.text !== 'string' || !d.text.trim()) throw new ContentError(file, where, 'has no text');
  if (d.lang === 'zh-CN') {
    if (!d.zh) throw new ContentError(file, where, 'is Mandarin (lang zh-CN) but has no zh { hant, py }');
    const it = zhItem(d.text, d.zh.hant, d.zh.py, d.meaning, d.picture, d.focus);
    if (it.id !== id) throw new ContentError(file, where, `its pinyin says its id should be ${it.id}`);
    return { ...it, ...(d.say ? { say: d.say } : {}), ...(d.kind ? { kind: d.kind } : {}), ...(d.translations ? { translations: d.translations } : {}) };
  }
  if (HAN.test(d.text) && d.lang !== 'ja-JP') throw new ContentError(file, where, 'has Chinese characters but no lang');
  const it: SpeakItem = { id, text: d.text, kind: d.kind ?? kindOfText(d.text) };
  if (d.say) it.say = d.say;
  if (d.picture) it.picture = d.picture;
  if (d.meaning) it.meaning = d.meaning;
  if (d.focus?.length) it.focus = d.focus;
  if (d.lang) it.lang = d.lang;
  if (d.ja) it.ja = d.ja;
  if (d.translations) it.translations = d.translations;
  return it;
}

export function buildCourse(data: CourseFile, file = `${data.language}.json`): BuiltCourse {
  if (!data.id || !data.language || !data.title) throw new ContentError(file, 'course', 'needs id, language and title');
  if (!data.exercisePrefix) throw new ContentError(file, 'course', 'needs exercisePrefix');
  const byId: Record<string, SpeakItem> = {};
  const items: SpeakItem[] = [];
  for (const [id, d] of Object.entries(data.items ?? {})) {
    const it = buildItem(file, id, d);
    byId[id] = it;
    items.push(it);
  }
  const want = (where: string, id: unknown): SpeakItem => {
    if (typeof id !== 'string' || !byId[id]) throw new ContentError(file, where, `names an item the file does not have: ${String(id)}`);
    return byId[id];
  };

  let n = 0;
  const lessonItemIds = new Set<string>();
  const seenLessons = new Set<string>();
  const buildExercise = (where: string, ex: ExerciseData): Exercise => {
    const id = `${data.exercisePrefix}-${++n}`;
    const used: SpeakItem[] = [];
    let built: Exercise;
    switch (ex.type) {
      case 'read-choice': {
        const passage = want(where, ex.passage), answer = want(where, ex.answer);
        const options = [answer, ...(ex.others ?? []).map((o) => want(where, o))];
        if (!ex.question?.trim() || !ex.questionHant?.trim() || !ex.explanation?.trim() || !ex.explanationHant?.trim()) throw new ContentError(file, where, 'reading needs a question and explanation in both interface languages');
        if (options.length < 2 || new Set(options.map((o) => o.text)).size !== options.length) throw new ContentError(file, where, 'reading needs distinct answer options');
        built = { ...ex, id, passage, answer, options };
        used.push(passage, ...options);
        break;
      }
      case 'arrange': {
        const item = want(where, ex.item);
        const normal = (s: string) => s.replace(/[\s\p{P}]/gu, '').toLowerCase();
        if (!Array.isArray(ex.chunks) || ex.chunks.length < 2 || ex.chunks.some((c) => !c.trim()) || normal(ex.chunks.join('')) !== normal(item.text)) throw new ContentError(file, where, 'sentence chunks must reconstruct the item');
        if (item.zh && (!ex.chunksHant || ex.chunksHant.length !== ex.chunks.length || ex.chunksHant.some((c) => !c.trim()) || normal(ex.chunksHant.join('')) !== normal(item.zh.hant))) throw new ContentError(file, where, 'Mandarin chunks need matching Traditional text');
        built = { ...ex, id, item };
        used.push(item);
        break;
      }
      case 'speak': {
        const item = want(where, ex.item);
        if (ex.prompt && !['text', 'image', 'translation'].includes(ex.prompt)) throw new ContentError(file, where, `unknown prompt ${ex.prompt}`);
        built = { id, type: 'speak', item, prompt: ex.prompt ?? 'text' };
        used.push(item);
        break;
      }
      case 'choose-heard': {
        const answer = want(where, ex.answer);
        const others = (ex.others ?? []).map((o) => want(where, o));
        if (!others.length) throw new ContentError(file, where, 'choose-heard needs at least one other option');
        built = { id, type: 'choose-heard', answer, options: [answer, ...others] };
        used.push(answer, ...others);
        break;
      }
      case 'minimal-pair': {
        if (!Array.isArray(ex.pair) || ex.pair.length !== 2) throw new ContentError(file, where, 'minimal-pair needs exactly two items');
        if (ex.answer !== 0 && ex.answer !== 1) throw new ContentError(file, where, 'minimal-pair answer must be 0 or 1');
        if (!ex.focus) throw new ContentError(file, where, 'minimal-pair needs a focus sound');
        const pair: [SpeakItem, SpeakItem] = [want(where, ex.pair[0]), want(where, ex.pair[1])];
        built = { id, type: 'minimal-pair', pair, answerIndex: ex.answer, focus: ex.focus };
        used.push(...pair);
        break;
      }
      case 'dialogue': {
        const tutor = ex.tutor ? want(where, ex.tutor) : undefined;
        const tutorLine = tutor ? tutor.text : ex.line;
        if (!tutorLine) throw new ContentError(file, where, 'dialogue needs a line or a tutor item');
        const replies = (ex.replies ?? []).map((r) => want(where, r));
        if (!replies.length) throw new ContentError(file, where, 'dialogue needs at least one reply');
        built = { id, type: 'dialogue', tutorLine, replies, picture: ex.picture, ...(tutor ? { tutor } : {}) };
        used.push(...(tutor ? [tutor] : []), ...replies);
        break;
      }
      default: throw new ContentError(file, where, `unknown exercise type ${(ex as { type?: string }).type}`);
    }
    used.forEach((it) => lessonItemIds.add(it.id));
    return built;
  };

  const units: Unit[] = (data.units ?? []).map((u) => {
    if (!u.id || !u.title) throw new ContentError(file, `unit ${u.id ?? '?'}`, 'needs id and title');
    const lessons: Lesson[] = (u.lessons ?? []).map((l) => {
      const where = `lesson ${l.id}`;
      if (!l.id || !l.title || !l.kind) throw new ContentError(file, where, 'needs id, title and kind');
      if (seenLessons.has(l.id)) throw new ContentError(file, where, 'appears twice');
      seenLessons.add(l.id);
      const exercises = {} as Record<ContentBand, Exercise[]>;
      for (const band of BANDS) {
        const list = l.exercises?.[band];
        if (!Array.isArray(list) || !list.length) throw new ContentError(file, where, `has no exercises for ${band}`);
        exercises[band] = list.map((ex, i) => buildExercise(`${where} ${band} #${i + 1}`, ex));
      }
      return { id: l.id, unitId: u.id, title: l.title, icon: l.icon, kind: l.kind, exercises, ...(l.guide ? { guide: l.guide } : {}) };
    });
    if (u.locked && lessons.length) throw new ContentError(file, `unit ${u.id}`, 'is locked but has lessons');
    const unit: Unit = { id: u.id, title: u.title, subtitle: u.subtitle, icon: u.icon, color: u.color, lessons };
    if (u.locked) unit.locked = true;
    if (u.grownUp) unit.grownUp = u.grownUp;
    return unit;
  });

  const course: Course = { id: data.id, title: data.title, ...(data.grownUpTitle ? { grownUpTitle: data.grownUpTitle } : {}), language: data.language, units };

  const check = {} as Record<ContentBand, SpeakItem[]>;
  for (const band of BANDS) {
    const list = data.check?.[band];
    if (!Array.isArray(list) || !list.length) throw new ContentError(file, 'check', `has no items for ${band}`);
    check[band] = list.map((id) => want(`check ${band}`, id));
  }

  const ladders: Record<PhonemeId, Ladder> = {};
  for (const [sound, rungs] of Object.entries(data.lab?.ladders ?? {})) {
    const ladder = {} as Ladder;
    for (const stage of LAB_STAGES) {
      const list = rungs?.[stage];
      if (!Array.isArray(list) || !list.length) throw new ContentError(file, `ladder ${sound}`, `has no ${stage}`);
      ladder[stage] = list.map((id) => want(`ladder ${sound} ${stage}`, id));
    }
    ladders[sound] = ladder;
  }
  const labSounds = data.lab?.sounds ?? Object.keys(ladders);
  for (const s of labSounds) if (!ladders[s]) throw new ContentError(file, `lab sound ${s}`, 'has no ladder');

  return { course, items, byId, lessonItems: [...lessonItemIds].map((id) => byId[id]), check, labSounds, ladders };
}
