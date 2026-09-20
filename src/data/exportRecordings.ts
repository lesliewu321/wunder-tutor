import type { Attempt, ChildProfile } from '../domain/types';
import { ITEM_INDEX } from '../content/course';
import { t } from '../i18n';

// "Share recordings for testing": a parent (or an adult learner) turns this learner's saved practice recordings into
// one file they can send to the Wunder Tutor team, so pronunciation checking can be measured on real voices — the
// app's accuracy has only been measured on synthetic ones. Nothing is uploaded: the file is saved on the device and
// the grown-up decides who gets it. It carries no name — only a learner code, age, home language and settings.

export const EXPORT_FORMAT = 'wunder-tutor/recordings@1';

/**
 * What the grown-up agrees to before the file is made — in the language they read it in. The very words they agreed
 * to are stored in the file with the date.
 */
export const consentText = (): string => t('settings.share.consent');

export interface ExportTake {
  itemId: string;
  /** What the learner was asked to say (Mandarin: Simplified, as scored). */
  text: string;
  /** Mandarin: numbered pinyin of the text. */
  py?: string;
  locale: string;
  context: Attempt['context'];
  at: string;
  /** The app's verdict at the time — scores only. */
  assessment: Attempt['assessment'];
  /** 16 kHz mono 16-bit WAV, base64. */
  wav: string;
}

export interface RecordingExport {
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  learner: { code: string; age: number; band: ChildProfile['band']; homeLanguage: ChildProfile['homeLanguage']; accent: ChildProfile['accent']; zhScript: ChildProfile['zhScript'] };
  consent: { text: string; at: string };
  takes: ExportTake[];
}

/** A short code for a learner — never their name. The same learner always gets the same code. */
export const learnerCode = (id: string): string => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return `L-${(h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 6)}`;
};

const base64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * Build the file. `load` fetches a stored recording; `toWav` turns it into 16 kHz WAV (the browser decodes it). A
 * recording that can't be read is skipped and counted.
 */
export async function buildRecordingExport(
  profile: ChildProfile, attempts: Attempt[], load: (key: string) => Promise<Blob | undefined>, toWav: (blob: Blob) => Promise<Blob>, now = Date.now(),
): Promise<{ file: Blob; name: string; takes: number; skipped: number }> {
  const at = new Date(now).toISOString();
  const takes: ExportTake[] = [];
  let skipped = 0;
  for (const a of attempts) {
    // "Say it right" text is the learner's own (a photographed page may hold names): not shared.
    if (a.profileId !== profile.id || !a.audioKey || a.itemId.startsWith('say:')) continue;
    try {
      const blob = await load(a.audioKey);
      if (!blob) { skipped++; continue; }
      const wav = new Uint8Array(await (await toWav(blob)).arrayBuffer());
      // Course items are looked up; "Say it right" text isn't in the course, so it is described by its own take.
      const item = ITEM_INDEX[a.itemId];
      const chinese = /\p{Script=Han}/u.test(a.text);
      const py = item?.zh?.py ?? (chinese ? a.assessment.words.map((w) => w.syllables[0]?.zh?.py).filter(Boolean).join(' ') || undefined : undefined);
      takes.push({
        itemId: a.itemId, text: a.text, py, locale: item?.lang ?? (chinese ? 'zh-CN' : profile.accent), context: a.context,
        at: new Date(a.createdAt).toISOString(), assessment: a.assessment, wav: base64(wav),
      });
    } catch { skipped++; }
  }
  const code = learnerCode(profile.id);
  const data: RecordingExport = {
    format: EXPORT_FORMAT, exportedAt: at,
    learner: { code, age: profile.age, band: profile.band, homeLanguage: profile.homeLanguage, accent: profile.accent, zhScript: profile.zhScript },
    consent: { text: consentText(), at },
    takes,
  };
  return { file: new Blob([JSON.stringify(data)], { type: 'application/json' }), name: `wunder-tutor-recordings-${code}-${at.slice(0, 10)}.json`, takes: takes.length, skipped };
}
