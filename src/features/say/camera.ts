// "Say it right": the camera, opened from anywhere (the big button in the middle of the bottom bar, or "My book" on
// Home). One camera for every device — phones, tablets and computers — shown inside the app with a gallery button,
// so it looks and works the same everywhere.

/** The browser can show a camera inside the page. */
export const canShowCamera = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

// Open the camera from anywhere; the one camera screen (CameraHost, next to the toasts) listens.
const listeners = new Set<() => void>();
export const openCamera = (): void => listeners.forEach((f) => f());
export const onOpenCamera = (f: () => void): (() => void) => {
  listeners.add(f);
  return () => { listeners.delete(f); };
};

interface Lens { deviceId: string; label: string }

/** The back cameras (names are only known once the camera is allowed). Chinese iPhones call them 後置/后置. */
export const backLenses = <T extends Lens & { kind?: string }>(devices: T[]): T[] =>
  devices.filter((d) => (d.kind ?? 'videoinput') === 'videoinput' && /back|rear|environment|後|后/i.test(d.label) && !/front|前/i.test(d.label));

/**
 * The lens to open. On some Android phones "the back camera" turns out to be the zoom (telephoto) lens — a page
 * looked 3× magnified and blurred on Leslie's phone. The main one is named "camera2 0, facing back"; elsewhere the
 * browser's own choice is kept (null). A lens the learner picked with the Lens button wins while it still exists.
 */
export function pickLens(lenses: Lens[], remembered?: string | null): Lens | null {
  return lenses.find((l) => l.deviceId === remembered) ?? lenses.find((l) => /camera2 0\b/.test(l.label)) ?? null;
}

const LENS_KEY = 'wunder-tutor/camera-lens';
export const rememberedLens = (): string | null => { try { return localStorage.getItem(LENS_KEY); } catch { return null; } };
export const rememberLens = (deviceId: string): void => { try { localStorage.setItem(LENS_KEY, deviceId); } catch { /* this visit only */ } };
/** A remembered lens that no longer opens (the phone lists depth and macro cameras too) must not fail every time. */
export const forgetLens = (): void => { try { localStorage.removeItem(LENS_KEY); } catch { /* nothing kept */ } };

// ---------------------------------------------------------------- taking the photo

interface PhotoRange { min?: number; max?: number }
interface PhotoTaker {
  getPhotoCapabilities(): Promise<{ imageWidth?: PhotoRange }>;
  takePhoto(settings?: { imageWidth?: number }): Promise<Blob>;
}
interface Size { width: number; height: number }

const TIMED_OUT = 'timed-out';
const within = <T>(p: Promise<T>, ms: number): Promise<T> => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(TIMED_OUT)), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/** The picture on screen, as a JPEG. */
export const frameOf = (video: HTMLVideoElement): Promise<Blob | null> => new Promise((resolve) => {
  if (!video.videoWidth) return resolve(null);
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
});

const sizeOf = async (photo: Blob): Promise<Size> => {
  const bmp = await createImageBitmap(photo);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  return size;
};

/** Long side over short side: the same for a picture and its rotated copy. */
const shape = (s: Size): number => Math.max(s.width, s.height) / Math.max(1, Math.min(s.width, s.height));

/**
 * Does the photograph show what the learner framed? Asked for a width alone, Chrome may pick a 16:9 photo size for a
 * 4:3 preview — the photo then misses an eighth of the page at each side, the start and end of every line.
 */
export const sameShape = (photo: Size, preview: Size): boolean => Math.abs(shape(photo) - shape(preview)) / shape(preview) < 0.04;

/** Wide enough for a page of small print (it is shrunk to 1600 px before upload). */
const PHOTO_WIDTH = 2560;
/** The phone's largest photo is only asked for up to about 16 megapixels: a 50-megapixel one can be too big for its browser to open. */
const MAX_SAFE_WIDTH = 4700;

/**
 * Take the photo. Where the browser can take a real photograph (Android Chrome), use it: the phone focuses first and
 * uses far more of its sensor than the moving preview, and a page of small print is often unreadable in a preview
 * frame. The photograph must show what was framed (see sameShape): if the page-sized one is cropped, the phone's
 * largest is tried. If no photograph can be had — not possible here, refused, cropped, or too slow — the picture on
 * screen is used instead.
 */
export async function takeStill(
  track: MediaStreamTrack | null, video: HTMLVideoElement,
  // Replaced in tests: the browser's photo taker (absent on iPhones and computers), the picture-on-screen fallback,
  // and how a photo is measured.
  Taker: (new (t: MediaStreamTrack) => PhotoTaker) | undefined = (globalThis as { ImageCapture?: new (t: MediaStreamTrack) => PhotoTaker }).ImageCapture,
  frame: (v: HTMLVideoElement) => Promise<Blob | null> = frameOf,
  measure: (photo: Blob) => Promise<Size> = sizeOf,
): Promise<Blob | null> {
  if (Taker && track?.readyState === 'live') {
    try {
      const taker = new Taker(track);
      const preview = { width: video.videoWidth, height: video.videoHeight };
      let tries: ({ imageWidth: number } | undefined)[] = [undefined];
      try {
        const w = (await within(taker.getPhotoCapabilities(), 1500)).imageWidth;
        if (w?.max) {
          const page = Math.max(w.min ?? 0, Math.min(w.max, PHOTO_WIDTH));
          tries = [{ imageWidth: page }, ...(w.max > page && w.max <= MAX_SAFE_WIDTH ? [{ imageWidth: w.max }] : []), undefined];
        }
      } catch { /* the phone's own size */ }
      for (const settings of tries) {
        try {
          const photo = await within(taker.takePhoto(settings), 4000);
          if (photo.size <= 10_000) continue;
          // A photo that can't be measured is taken on trust; one that is cropped is not.
          const fits = !preview.width || (await measure(photo).then((size) => sameShape(size, preview), () => true));
          if (fits) return photo;
        } catch (e) {
          if ((e as Error | null)?.message === TIMED_OUT) break; // a phone that hangs gets no second wait
        }
      }
    } catch { /* the picture on screen instead */ }
  }
  return frame(video);
}
