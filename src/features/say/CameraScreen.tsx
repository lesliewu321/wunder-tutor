import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';
import { backLenses, canShowCamera, pickLens, rememberedLens, rememberLens, takeStill } from './camera';
import type { Problem } from './messages';

// The camera for "Say it right": the whole camera picture (never cropped or zoomed to fill the screen), the shutter
// in the middle, the gallery on the left, a Lens button on the right when the phone has several back cameras, and a
// torch where it has one. The photo is a real photograph where the browser can take one (focused, full detail), else
// the picture on screen. While the page is read the photo stays up; if it can't be read, the camera comes back with
// the reason — and a button when there is something to do about it. A setup problem found before the first photo
// (`blocked`: no access code, a refused key) is shown instead of letting the learner photograph in vain. A browser
// that won't show a camera here (blocked, none, too old) offers the phone's own camera app and the gallery instead.

type Cam = 'starting' | 'live' | 'blocked' | 'none' | 'failed';
const CAM_PROBLEM: Record<Exclude<Cam, 'starting' | 'live'>, string> = {
  blocked: 'The camera is switched off for Wunder Tutor. Allow it in your browser, or use the camera app.',
  none: 'No camera was found here. Choose a photo instead.',
  failed: 'The camera didn’t start. Use the camera app, or choose a photo.',
};
const problemOf = (e: unknown): Cam => {
  const name = (e as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' ? 'none' : 'failed';
};
const FIX_LABEL: Record<NonNullable<Problem['fix']>, string> = { code: 'Enter the code', connections: 'Check connections' };

interface Props {
  kid: boolean;
  /** A setup problem found before any photo: shown instead of the shutter. */
  blocked: Problem | null;
  onClose: () => void;
  onFix: (fix: NonNullable<Problem['fix']>) => void;
  /** Returns what went wrong, or null when the page was read (the camera is then closed by its owner). */
  read: (photo: Blob, signal: AbortSignal) => Promise<Problem | null>;
}

export function CameraScreen({ kid, blocked, onClose, onFix, read }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const switchTo = useRef<(deviceId: string) => Promise<void>>(async () => undefined);
  const reading = useRef<AbortController | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const cameraApp = useRef<HTMLInputElement>(null);
  const shutter = useRef<HTMLButtonElement>(null);
  const [cam, setCam] = useState<Cam>(canShowCamera() ? 'starting' : 'failed');
  const [mirror, setMirror] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [lenses, setLenses] = useState<{ deviceId: string; label: string }[]>([]);
  const [lens, setLens] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (!canShowCamera()) return;
    const run = { gone: false };
    let stream: MediaStream | null = null;
    const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };

    /** Open a lens (or the browser's back camera) at its widest: 4:3 is the whole sensor; 16:9 cuts it. */
    const start = async (deviceId?: string): Promise<MediaStreamTrack | null> => {
      stop();
      setTorch(null);
      const shape = { width: { ideal: 2560 }, height: { ideal: 1920 }, aspectRatio: { ideal: 4 / 3 } };
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, ...shape } : { facingMode: { ideal: 'environment' }, ...shape } });
      if (run.gone) { s.getTracks().forEach((t) => t.stop()); return null; }
      stream = s;
      const t = s.getVideoTracks()[0] ?? null;
      track.current = t;
      if (!t) return null;
      t.addEventListener('ended', () => { void revive(); }); // the phone took the camera away while we were looking
      const settings = t.getSettings() as MediaTrackSettings & { zoom?: number };
      const caps = t.getCapabilities?.() as { torch?: boolean; zoom?: { min: number; max: number }; focusMode?: string[] } | undefined;
      // A camera facing the learner (a laptop's: no facing reported, no touch screen) is shown like a mirror; the
      // photo itself never is.
      setMirror(settings.facingMode === 'user' || (!settings.facingMode && !navigator.maxTouchPoints));
      if (caps?.torch) setTorch(false);
      // Never start zoomed in, and keep refocusing as the page moves closer (print is small).
      const advanced: Record<string, unknown>[] = [];
      const plain = caps?.zoom ? Math.max(caps.zoom.min, 1) : null;
      if (plain != null && (settings.zoom ?? plain) > plain) advanced.push({ zoom: plain });
      if (caps?.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
      for (const one of advanced) await t.applyConstraints({ advanced: [one as MediaTrackConstraintSet] }).catch(() => undefined);
      const v = video.current;
      if (!v) return t;
      v.srcObject = s;
      await v.play();
      if (!run.gone) { setCam('live'); setLens(settings.deviceId ?? null); }
      return t;
    };

    switchTo.current = async (deviceId: string) => {
      setCam('starting');
      try { await start(deviceId); rememberLens(deviceId); } catch (e) { if (!run.gone) setCam(problemOf(e)); }
    };

    // The phone takes the camera away when another app uses it (its own camera app, a video call) or while this page
    // is in the background: back here, a dead picture is restarted rather than left black.
    let reviving = false;
    const revive = async () => {
      if (run.gone || reviving || document.visibilityState !== 'visible') return;
      const t = stream?.getVideoTracks()[0];
      if (t && t.readyState === 'live' && !t.muted) return;
      reviving = true;
      try { await start(t?.getSettings().deviceId || undefined); } catch (e) { if (!run.gone) setCam(problemOf(e)); } finally { reviving = false; }
    };
    const onVisible = () => { void revive(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    (async () => {
      try {
        const remembered = rememberedLens();
        let t = await (remembered ? start(remembered).catch(() => start()) : start());
        if (!t || run.gone) return;
        // Now that the camera is allowed, the lenses have names: open the main one if the browser chose another.
        const backs = backLenses(await navigator.mediaDevices.enumerateDevices());
        if (run.gone) return;
        setLenses(backs);
        const want = pickLens(backs, remembered);
        if (want && want.deviceId !== t.getSettings().deviceId) t = await start(want.deviceId);
      } catch (e) {
        if (!run.gone) setCam(problemOf(e));
      }
    })();
    return () => { run.gone = true; stop(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, []);

  // Closing stops the camera and any reading still going.
  const close = () => { reading.current?.abort(); onClose(); };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (cam === 'live') shutter.current?.focus(); }, [cam]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot); }, [shot]);

  const readPhoto = async (photo: Blob) => {
    setProblem(null);
    setShot(URL.createObjectURL(photo));
    const ctl = new AbortController();
    reading.current = ctl;
    const why = await read(photo, ctl.signal);
    if (ctl.signal.aborted) return;
    if (why) { setProblem(why); setShot(null); }
  };

  const take = async () => {
    const v = video.current;
    if (!v?.videoWidth || shot || taking) return;
    setTaking(true);
    setProblem(null);
    try {
      const photo = await takeStill(track.current, v);
      if (photo) void readPhoto(photo);
    } finally {
      setTaking(false);
    }
  };

  const flip = async () => {
    const t = track.current;
    if (!t || torch === null) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setTorch(null); }
  };

  const live = cam === 'live';
  const trouble = cam !== 'starting' && cam !== 'live' ? CAM_PROBLEM[cam] : null;
  const at = lenses.findIndex((l) => l.deviceId === lens);
  const nextLens = lenses.length > 1 ? lenses[(at + 1) % lenses.length] : null;
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readPhoto(f); };
  // A setup problem that arrives while a photo is being taken or read waits until that is over.
  const stopped = blocked && !shot && !taking ? blocked : null;
  const idle = !shot && !taking && !stopped;
  const fixButton = (p: Problem) => p.fix && <button type="button" className="camera__app" onClick={() => onFix(p.fix!)}>{FIX_LABEL[p.fix]}</button>;

  return createPortal(
    <div className="camera" role="dialog" aria-modal="true" aria-label="Camera: take a photo of a page">
      <video ref={video} className={`camera__video ${mirror ? 'camera__video--mirror' : ''} ${live && !stopped ? '' : 'camera__video--off'}`} playsInline muted aria-hidden />
      {shot && <img className="camera__shot" src={shot} alt="" />}
      {(shot || taking) && <div className="camera__reading" role="status">{shot && <span className="camera__scan" aria-hidden />}{taking ? 'Hold still…' : kid ? 'Reading your page…' : 'Reading the page…'}</div>}

      <div className="camera__top">
        <button type="button" className="camera__round" aria-label="Close the camera" onClick={close}><Icon name="close" /></button>
        <span className="camera__title">Say it right</span>
        {torch !== null && live && !stopped ? (
          <button type="button" className={`camera__round ${torch ? 'is-on' : ''}`} aria-label={torch ? 'Torch off' : 'Torch on'} aria-pressed={torch} onClick={() => void flip()}><Icon name="bolt" fill={torch} /></button>
        ) : <span className="camera__round camera__round--empty" />}
      </div>

      {stopped ? (
        <div className="camera__middle" role="alert"><p>{stopped.text}</p>{fixButton(stopped)}</div>
      ) : (
        <>
          {problem && !shot && <div className="camera__problem" role="alert"><p>{problem.text}</p>{fixButton(problem)}</div>}
          {cam === 'starting' && <p className="camera__middle">Starting the camera…</p>}
          {trouble && !shot && (
            <div className="camera__middle">
              <p>{trouble}</p>
              {cam !== 'none' && <button type="button" className="camera__app" onClick={() => cameraApp.current?.click()}><Icon name="camera" size={20} />Use the camera app</button>}
            </div>
          )}
        </>
      )}

      <div className="camera__bottom">
        {live && idle && !problem && <p className="camera__hint">{kid ? 'Get the whole page in the picture, then tap the white button' : 'Get the whole page in the picture, then tap'}</p>}
        {/* Always a way out to the phone's own camera (best focus, flash, every lens) if this preview looks blurry. */}
        {live && idle && navigator.maxTouchPoints > 0 && <button type="button" className="camera__link" onClick={() => cameraApp.current?.click()}>Blurry? Use the phone’s camera instead</button>}
        <div className="camera__bar">
          <button type="button" className="camera__side" onClick={() => gallery.current?.click()} disabled={!idle}>
            <span className="camera__round"><Icon name="image" /></span><small>Photos</small>
          </button>
          <button ref={shutter} type="button" className="camera__shutter" aria-label="Take the photo" onClick={() => void take()} disabled={!live || !idle} />
          {nextLens && !stopped ? (
            <button type="button" className="camera__side" onClick={() => void switchTo.current(nextLens.deviceId)} disabled={!idle || cam === 'starting'} aria-label={`Switch lens (${Math.max(at, 0) + 1} of ${lenses.length})`}>
              <span className="camera__round"><Icon name="retry" /></span><small>Lens {Math.max(at, 0) + 1}/{lenses.length}</small>
            </button>
          ) : <span className="camera__side" aria-hidden />}
        </div>
      </div>
      <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />
      <input ref={cameraApp} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>,
    document.body,
  );
}
