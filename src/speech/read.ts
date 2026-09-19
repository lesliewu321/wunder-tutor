import { apiFetch } from './health';

// "Say it right": turn a photo of a page, or typed text, into sentences to practise (server: POST /api/read).

export interface ReadLine {
  /** As written (on the page, or as typed). */
  text: string;
  /** Chinese lines that passed the checks: both scripts and the pinyin (numbered, one syllable per character). */
  traditional?: string;
  simplified?: string;
  pinyin?: string;
}

export interface Reading { language: 'en' | 'zh' | 'other' | 'none'; lines: ReadLine[] }

export class ReadError extends Error {
  constructor(readonly code: 'offline' | 'busy' | 'unavailable' | 'failed') { super(code); }
}

/** Photos are shrunk before upload: the text stays sharp and the upload stays small. */
const MAX_SIDE = 1600;

export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ReadError('failed'))), 'image/jpeg', 0.85));
}

async function post(body: Blob | string, type: string): Promise<Reading> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  let res: Response;
  try {
    res = await apiFetch('/api/read', { method: 'POST', headers: { 'Content-Type': type }, body, signal: ctl.signal });
  } catch {
    throw new ReadError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new ReadError('busy');
  if (res.status === 401 || res.status === 503) throw new ReadError('unavailable');
  if (!res.ok) throw new ReadError('failed');
  return (await res.json()) as Reading;
}

export const readPhoto = async (photo: Blob): Promise<Reading> => post(await shrinkPhoto(photo), 'image/jpeg');
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
