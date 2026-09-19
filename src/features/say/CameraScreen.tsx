import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';
import { backLenses, canShowCamera, pickLens, rememberedLens, rememberLens } from './camera';

// The camera for "Say it right": the whole camera picture (never cropped or zoomed to fill the screen — the photo is
// everything the lens sees), the shutter in the middle, the gallery on the left, a Lens button on the right when the
// phone has several back cameras, and a torch where it has one. While the page is read the photo stays up; if it
// can't be read, the camera comes back with the reason. A browser that won't show a camera here (blocked, none, too
// old) offers the phone's own camera app and the gallery instead.

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

/** `read` returns what went wrong, or null when the page was read (the camera is then closed by its owner). */
export function CameraScreen({ kid, onClose, read }: { kid: boolean; onClose: () => void; read: (photo: Blob, signal: AbortSignal) => Promise<string | null> }) {
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
  const [shot, setShot] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!canShowCamera()) return;
    const run = { gone: false };
    let stream: MediaStream | null = null;
    const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };

    /** Open a lens (or the browser's back camera) at its widest: 4:3 is the whole sensor; 16:9 cuts it. */
    const start = async (deviceId?: string): Promise<MediaStreamTrack | null> => {
      stop();
      setTorch(null);
      const shape = { width: { ideal: 1920 }, aspectRatio: { ideal: 4 / 3 } };
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, ...shape } : { facingMode: { ideal: 'environment' }, ...shape } });
      if (run.gone) { s.getTracks().forEach((t) => t.stop()); return null; }
      stream = s;
      const t = s.getVideoTracks()[0] ?? null;
      track.current = t;
      if (!t) return null;
      const settings = t.getSettings() as MediaTrackSettings & { zoom?: number };
      const caps = t.getCapabilities?.() as { torch?: boolean; zoom?: { min: number; max: number } } | undefined;
      // A camera facing the learner (a laptop's: no facing reported, no touch screen) is shown like a mirror; the
      // photo itself never is.
      setMirror(settings.facingMode === 'user' || (!settings.facingMode && !navigator.maxTouchPoints));
      if (caps?.torch) setTorch(false);
      // Never start zoomed in.
      const plain = caps?.zoom ? Math.max(caps.zoom.min, 1) : null;
      if (plain != null && (settings.zoom ?? plain) > plain) await t.applyConstraints({ advanced: [{ zoom: plain } as MediaTrackConstraintSet] }).catch(() => undefined);
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
    return () => { run.gone = true; stop(); };
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

  const take = () => {
    const v = video.current;
    if (!v?.videoWidth || shot) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    canvas.toBlob((b) => { if (b) void readPhoto(b); }, 'image/jpeg', 0.92);
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

  return createPortal(
    <div className="camera" role="dialog" aria-modal="true" aria-label="Camera: take a photo of a page">
      <video ref={video} className={`camera__video ${mirror ? 'camera__video--mirror' : ''} ${live ? '' : 'camera__video--off'}`} playsInline muted aria-hidden />
      {shot && <img className="camera__shot" src={shot} alt="" />}
      {shot && <div className="camera__reading" role="status"><span className="camera__scan" aria-hidden />{kid ? 'Reading your page…' : 'Reading the page…'}</div>}

      <div className="camera__top">
        <button type="button" className="camera__round" aria-label="Close the camera" onClick={close}><Icon name="close" /></button>
        <span className="camera__title">Say it right</span>
        {torch !== null && live ? (
          <button type="button" className={`camera__round ${torch ? 'is-on' : ''}`} aria-label={torch ? 'Torch off' : 'Torch on'} aria-pressed={torch} onClick={() => void flip()}><Icon name="bolt" fill={torch} /></button>
        ) : <span className="camera__round camera__round--empty" />}
      </div>

      {problem && !shot && <p className="camera__problem" role="alert">{problem}</p>}
      {cam === 'starting' && <p className="camera__middle">Starting the camera…</p>}
      {trouble && !shot && (
        <div className="camera__middle">
          <p>{trouble}</p>
          {cam !== 'none' && <button type="button" className="camera__app" onClick={() => cameraApp.current?.click()}><Icon name="camera" size={20} />Use the camera app</button>}
        </div>
      )}

      <div className="camera__bottom">
        {live && !shot && <p className="camera__hint">{kid ? 'Get the whole page in the picture, then tap the white button' : 'Get the whole page in the picture, then tap'}</p>}
        <div className="camera__bar">
          <button type="button" className="camera__side" onClick={() => gallery.current?.click()} disabled={!!shot}>
            <span className="camera__round"><Icon name="image" /></span><small>Photos</small>
          </button>
          <button ref={shutter} type="button" className="camera__shutter" aria-label="Take the photo" onClick={take} disabled={!live || !!shot} />
          {nextLens ? (
            <button type="button" className="camera__side" onClick={() => void switchTo.current(nextLens.deviceId)} disabled={!!shot || cam === 'starting'} aria-label={`Switch lens (${Math.max(at, 0) + 1} of ${lenses.length})`}>
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
