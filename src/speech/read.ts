import { apiFetch } from './health';

// "Say it right": turn a photo of a page, or typed text, into sentences to practise (server: POST /api/read).

export interface ReadLine {
  /** As written (on the page, or as typed). */
  text: string;
  /** The sentence's language, from the reader (typed English has none): only "en" and checked Chinese are practised. */
  lang?: 'en' | 'zh' | 'other';
  /** Chinese lines that passed the checks: both scripts and the pinyin (numbered, one syllable per character). */
  traditional?: string;
  simplified?: string;
  pinyin?: string;
}

export interface Reading { language: 'en' | 'zh' | 'other' | 'none'; lines: ReadLine[] }

export class ReadError extends Error {
  /**
   * `locked`: this device's access code was refused (none entered, or changed on the server since).
   * `lockout`: too many wrong codes came from this network; even the right one is turned away for a while.
   * `unavailable`: the server can't read pages at all yet (no key).
   * `cancelled`: the learner closed the camera.
   * `detail`: the server's reason ("read_timeout"), shown small so a tester's screenshot says what went wrong.
   */
  constructor(readonly code: 'offline' | 'busy' | 'locked' | 'lockout' | 'unavailable' | 'photo' | 'failed' | 'cancelled', readonly detail?: string) { super(code); }
}

/** Photos are shrunk before upload: the text stays sharp and the upload stays small. */
const MAX_SIDE = 1600;

interface Decoded { image: CanvasImageSource; width: number; height: number; done: () => void }

/**
 * Open a photo. An <img> is the second try: older iPhones and iPads have no createImageBitmap for files, and a very
 * large camera photo can be too big for it. A format the browser can't open at all (HEIC on a computer) fails both.
 */
async function decode(file: Blob): Promise<Decoded> {
  try {
    const bmp = await createImageBitmap(file);
    return { image: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close?.() };
  } catch { /* try an <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty');
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ReadError('photo');
  }
}

export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const photo = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(photo.width, photo.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(photo.width * scale));
  canvas.height = Math.max(1, Math.round(photo.height * scale));
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff'; // a transparent PNG would otherwise turn black
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(photo.image, 0, 0, canvas.width, canvas.height);
  photo.done();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ReadError('failed'))), 'image/jpeg', 0.85));
}

/**
 * What a failed answer means. Our server names its errors ("read_timeout", plus a `note` or Google's `finish`
 * reason); anything else came from the platform in front of it — its own code is kept ("cf1102") so a screenshot says
 * which. Only our own words decide the kind of failure: a platform's 503 is not "reading isn't set up".
 */
export function readFailure(status: number, body: string): ReadError {
  const parse = (): { error?: string; note?: string; finish?: string } | null => { try { return JSON.parse(body); } catch { return null; } };
  const ours = parse();
  if (!ours?.error) {
    const platform = /error code:?\s*(\d{3,4})/i.exec(body)?.[1];
    return new ReadError(status === 429 ? 'busy' : 'failed', `http_${status}${platform ? ` cf${platform}` : ''}`);
  }
  const detail = [ours.error, ours.note, ours.finish].filter(Boolean).join(' ');
  if (status === 401) return new ReadError('locked', detail);
  if (ours.error === 'too_many_attempts') return new ReadError('lockout', detail);
  if (status === 429) return new ReadError('busy', detail);
  if (ours.error === 'gemini_not_configured') return new ReadError('unavailable', detail);
  return new ReadError('failed', detail);
}

/** `cancel`: the learner closed the camera — nothing is sent, or the request stops. */
async function post(body: Blob | string, type: string, cancel?: AbortSignal): Promise<Reading> {
  if (cancel?.aborted) throw new ReadError('cancelled');
  const ctl = new AbortController();
  // Longer than the server's own limit (40 s), so a slow page ends with the server's answer, not ours.
  const timer = setTimeout(() => ctl.abort(), 60000);
  const stop = () => ctl.abort();
  cancel?.addEventListener('abort', stop);
  let res: Response;
  try {
    res = await apiFetch('/api/read', { method: 'POST', headers: { 'Content-Type': type }, body, signal: ctl.signal });
  } catch {
    if (cancel?.aborted) throw new ReadError('cancelled');
    throw new ReadError(ctl.signal.aborted ? 'failed' : 'offline', ctl.signal.aborted ? 'app_timeout' : undefined);
  } finally {
    clearTimeout(timer);
    cancel?.removeEventListener('abort', stop);
  }
  if (!res.ok) throw readFailure(res.status, await res.text().catch(() => ''));
  try { return (await res.json()) as Reading; } catch { throw new ReadError('failed', 'bad_answer'); }
}

export const readPhoto = async (photo: Blob, cancel?: AbortSignal): Promise<Reading> => {
  const small = await shrinkPhoto(photo);
  return post(small, 'image/jpeg', cancel); // closing the camera while the photo was being shrunk sends nothing
};
export const prepareText = (text: string): Promise<Reading> => post(JSON.stringify({ text }), 'application/json');

/**
 * English typed text needs no server: split into sentences here. Chinese always goes to the server for pinyin.
 */
export const splitSentences = (text: string): string[] =>
  text.replace(/\s+/g, ' ').trim()
    // A sentence ends at . ! ? … before a capital — but not after a title or abbreviation ("Dr. Who", "Mrs. Lee").
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|St|Mt|No|vs|etc|e\.g|i\.e)\.)(?<=[.!?…])\s+(?=[A-Z0-9"“'‘(])/)
    .map((s) => s.trim()).filter(Boolean)
    .flatMap((s) => (s.length <= 160 ? [s] : s.match(/.{1,150}(?:\s|$)/g)!.map((x) => x.trim())));
