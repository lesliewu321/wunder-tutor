// Every line the app can ask the teacher's voice for, as the app asks it: lessons (every band), the listening
// exercises' answers and pairs, the dialogue lines, the conversations, the Lab ladders and their sound examples, the
// setup checks and the accent preview — each with its locale, and English in both accents.
//
//   npx vite-node eval/voice-lines.ts             → eval/.cache/voice-lines.json, and a count per locale
//
// Then `node scripts/warm-voice.mjs` asks a server for each (see there): the list is what "every line has a voice"
// means, and what warming the shared cache means.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_LESSONS, ASSESSMENT_ITEMS } from '../src/content/course';
import { FR_CHECK_ITEMS } from '../src/content/fr/course';
import { JA_CHECK_ITEMS } from '../src/content/ja/course';
import { LADDERS } from '../src/content/lab';
import { exampleSpeech, soundLocale } from '../src/content/phonemes';
import { SCENARIOS } from '../src/content/scenarios';
import { ZH_CHECK_ITEMS } from '../src/content/zh/course';
import type { Accent, ContentBand, Locale, PhonemeId, SpeakItem } from '../src/domain/types';
import { ACCENT_PREVIEW_LINE, localeOf } from '../src/speech/voice';

export interface VoiceLine { text: string; accent: Locale; kind?: 'syllable'; where: string }

const BANDS: ContentBand[] = ['little', 'junior', 'teen'];
const ACCENTS: Accent[] = ['en-US', 'en-GB'];

export function voiceLines(): VoiceLine[] {
  const out = new Map<string, VoiceLine>();
  const add = (text: string, accent: Locale, where: string, kind?: SpeakItem['kind']) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const k = kind === 'syllable' ? 'syllable' : undefined;
    const key = `${accent}|${k ?? ''}|${clean}`;
    if (!out.has(key)) out.set(key, { text: clean, accent, kind: k, where });
  };
  /** An item is spoken in its own language, or in English in either accent. */
  const item = (it: SpeakItem, where: string) => {
    const text = it.say ?? it.text;
    if (it.lang) add(text, it.lang, where, it.kind);
    else for (const a of ACCENTS) add(text, a, where, it.kind);
  };

  for (const lesson of ALL_LESSONS) {
    for (const band of BANDS) {
      for (const ex of lesson.exercises[band] ?? []) {
        const where = `lesson ${lesson.id} (${band})`;
        if (ex.type === 'speak') item(ex.item, where);
        else if (ex.type === 'choose-heard') { item(ex.answer, where); ex.options.forEach((o) => item(o, where)); }
        else if (ex.type === 'minimal-pair') {
          ex.pair.forEach((p) => item(p, where));
          // The pair said together after a right answer (src/features/lesson/ChoiceExercise.tsx).
          const [a, b] = ex.pair;
          const both = a.lang ? `${a.text}，${b.text}。` : `${a.text}. ${b.text}.`;
          if (a.lang) add(both, a.lang, where); else for (const acc of ACCENTS) add(both, acc, where);
        } else if (ex.type === 'dialogue') {
          const tutorAccent = (acc: Accent) => localeOf(ex.tutor, acc);
          if (ex.tutor?.lang) add(ex.tutorLine, ex.tutor.lang, where); else for (const acc of ACCENTS) add(ex.tutorLine, tutorAccent(acc), where);
          ex.replies.forEach((r) => item(r, where));
        }
      }
    }
  }
  for (const s of SCENARIOS) {
    const where = `conversation ${s.id}`;
    for (const band of BANDS) {
      for (const turn of s.turns) { item(turn.tutor[band], where); turn.replies[band].forEach((r) => item(r, where)); }
      item(s.closing[band], where);
    }
  }
  for (const [sound, ladder] of Object.entries(LADDERS) as [PhonemeId, (typeof LADDERS)[PhonemeId]][]) {
    const where = `lab ${sound}`;
    for (const rung of Object.values(ladder)) rung.forEach((it) => item(it, where));
    for (const acc of ACCENTS) add(exampleSpeech(sound), soundLocale(sound, acc), where);
  }
  for (const [name, checks] of [['check en', ASSESSMENT_ITEMS], ['check zh', ZH_CHECK_ITEMS], ['check fr', FR_CHECK_ITEMS], ['check ja', JA_CHECK_ITEMS]] as const) {
    for (const band of BANDS) checks[band].forEach((it) => item(it, name));
  }
  for (const acc of ACCENTS) add(ACCENT_PREVIEW_LINE, acc, 'setup accent preview');
  return [...out.values()];
}

{
  const lines = voiceLines();
  const dir = join(dirname(fileURLToPath(import.meta.url)), '.cache');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'voice-lines.json'), JSON.stringify(lines, null, 1));
  const per = new Map<string, number>();
  for (const l of lines) per.set(l.accent, (per.get(l.accent) ?? 0) + 1);
  console.log(`${lines.length} lines → eval/.cache/voice-lines.json`);
  for (const [accent, n] of per) console.log(`  ${accent.padEnd(6)} ${n}`);
  console.log(`  (each also has a slow take: ${lines.length * 2} takes in all)`);
}
