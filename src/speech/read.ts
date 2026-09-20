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
  /** `detail`: the server's reason ("read_timeout"), shown small so a tester's screenshot says what went wrong. */
  constructor(readonly code: 'offline' | 'busy' | 'unavailable' | 'photo' | 'failed', readonly detail?: string) { super(code); }
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

/** `cancel`: the learner closed the camera — the request stops. */
async function post(body: Blob | string, type: string, cancel?: AbortSignal): Promise<Reading> {
  const ctl = new AbortController();
  // Longer than the server's own limit (40 s), so a slow page ends with the server's answer, not ours.
  const timer = setTimeout(() => ctl.abort(), 60000);
  const stop = () => ctl.abort();
  cancel?.addEventListener('abort', stop);
  let res: Response;
  try {
    res = await apiFetch('/api/read', { method: 'POST', headers: { 'Content-Type': type }, body, signal: ctl.signal });
  } catch {
    throw new ReadError(ctl.signal.aborted ? 'failed' : 'offline', ctl.signal.aborted ? 'app_timeout' : undefined);
  } finally {
    clearTimeout(timer);
    cancel?.removeEventListener('abort', stop);
  }
  // Our server names its errors ("read_timeout"); anything else came from the platform in front of it — keep its own
  // code ("error code: 1102") so a screenshot says which.
  const reason = async () => {
    const body = await res.text().catch(() => '');
    try {
      const ours = JSON.parse(body) as { error?: string; note?: string } | null;
      if (ours?.error) return ours.note ? `${ours.error} ${ours.note}` : ours.error;
    } catch { /* not ours */ }
    const platform = /error code:?\s*(\d{3,4})/i.exec(body)?.[1];
    return `http_${res.status}${platform ? ` cf${platform}` : ''}`;
  };
  if (res.status === 429) throw new ReadError('busy');
  if (res.status === 401 || res.status === 503) throw new ReadError('unavailable', await reason());
  if (!res.ok) throw new ReadError('failed', await reason());
  try { return (await res.json()) as Reading; } catch { throw new ReadError('failed', 'bad_answer'); }
}

export const readPhoto = async (photo: Blob, cancel?: AbortSignal): Promise<Reading> => post(await shrinkPhoto(photo), 'image/jpeg', cancel);
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
