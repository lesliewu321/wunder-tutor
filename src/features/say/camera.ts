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
