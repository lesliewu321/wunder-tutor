import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';
import { canShowCamera, visibleRegion } from './camera';

// The camera for "Say it right": the live picture fills the screen, with the shutter in the middle, the gallery on
// the left and a torch where the phone has one. The photo is exactly what was on screen. While the page is read the
// photo stays up; if it can't be read, the camera comes back with the reason. A browser that won't show a camera
// here (blocked, none, too old) offers the phone's own camera app and the gallery instead.

type Cam = 'starting' | 'live' | 'blocked' | 'none' | 'failed';
const CAM_PROBLEM: Record<Exclude<Cam, 'starting' | 'live'>, string> = {
  blocked: 'The camera is switched off for Wunder Tutor. Allow it in your browser, or use the camera app.',
  none: 'No camera was found here. Choose a photo instead.',
  failed: 'The camera didn’t start. Use the camera app, or choose a photo.',
};

/** `read` returns what went wrong, or null when the page was read (the camera is then closed by its owner). */
export function CameraScreen({ kid, onClose, read }: { kid: boolean; onClose: () => void; read: (photo: Blob, signal: AbortSignal) => Promise<string | null> }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const reading = useRef<AbortController | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const cameraApp = useRef<HTMLInputElement>(null);
  const shutter = useRef<HTMLButtonElement>(null);
  const [cam, setCam] = useState<Cam>(canShowCamera() ? 'starting' : 'failed');
  const [mirror, setMirror] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!canShowCamera()) return;
    let stream: MediaStream | null = null;
    let gone = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (gone) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const t = s.getVideoTracks()[0];
        track.current = t ?? null;
        // A camera facing the learner (a laptop's: no facing reported, no touch screen) is shown like a mirror; the
        // photo itself never is.
        const facing = t?.getSettings().facingMode;
        setMirror(facing === 'user' || (!facing && !navigator.maxTouchPoints));
        if ((t?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch(false);
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play();
        if (!gone) setCam('live');
      } catch (e) {
        if (gone) return;
        const name = (e as { name?: string } | null)?.name;
        setCam(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'failed');
      }
    })();
    return () => { gone = true; stream?.getTracks().forEach((t) => t.stop()); };
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
    const r = visibleRegion(v.videoWidth, v.videoHeight, v.clientWidth, v.clientHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(r.sw);
    canvas.height = Math.round(r.sh);
    canvas.getContext('2d')!.drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => { if (b) void readPhoto(b); }, 'image/jpeg', 0.92);
  };

  const flip = async () => {
    const t = track.current;
    if (!t || torch === null) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setTorch(null); }
  };

  const live = cam === 'live';
  const trouble = cam !== 'starting' && cam !== 'live' ? CAM_PROBLEM[cam] : null;
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readPhoto(f); };

  return createPortal(
    <div className="camera" role="dialog" aria-modal="true" aria-label="Camera: take a photo of a page">
      <video ref={video} className={`camera__video ${mirror ? 'camera__video--mirror' : ''} ${live ? '' : 'camera__video--off'}`} playsInline muted aria-hidden />
      {live && !shot && <div className="camera__frame" aria-hidden><i /><i /><i /><i /></div>}
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
        {live && !shot && <p className="camera__hint">{kid ? 'Point at your book — fit the words in the frame' : 'Fit the page inside the frame, then tap'}</p>}
        <div className="camera__bar">
          <button type="button" className="camera__side" onClick={() => gallery.current?.click()} disabled={!!shot}>
            <span className="camera__round"><Icon name="image" /></span><small>Photos</small>
          </button>
          <button ref={shutter} type="button" className="camera__shutter" aria-label="Take the photo" onClick={take} disabled={!live || !!shot} />
          <span className="camera__side" aria-hidden />
        </div>
      </div>
      <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />
      <input ref={cameraApp} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>,
    document.body,
  );
}
