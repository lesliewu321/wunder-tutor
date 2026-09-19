// "Say it right": the camera, opened from anywhere (the big button in the middle of the bottom bar, or "My book" on
// Home). One camera for every device — phones, tablets and computers — shown inside the app with a gallery button,
// so it looks and works the same everywhere.

/** The browser can show a camera inside the page. */
export const canShowCamera = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/**
 * The part of the camera picture that is on screen: the view fills the screen and crops the rest, and the photo is
 * exactly what the learner saw. `vw`×`vh` is the camera picture, `ew`×`eh` the view.
 */
export function visibleRegion(vw: number, vh: number, ew: number, eh: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!vw || !vh || !ew || !eh) return { sx: 0, sy: 0, sw: vw, sh: vh };
  const scale = Math.max(ew / vw, eh / vh);
  const sw = Math.min(vw, ew / scale), sh = Math.min(vh, eh / scale);
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

// Open the camera from anywhere; the one camera screen (CameraHost, next to the toasts) listens.
const listeners = new Set<() => void>();
export const openCamera = (): void => listeners.forEach((f) => f());
export const onOpenCamera = (f: () => void): (() => void) => {
  listeners.add(f);
  return () => { listeners.delete(f); };
};
