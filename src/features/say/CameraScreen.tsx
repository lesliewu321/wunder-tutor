import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { Icon } from '../../ui/Icon';
import { backLenses, canShowCamera, forgetLens, pickLens, rememberedLens, rememberLens, takeStill } from './camera';
import type { Problem } from './messages';

// The camera for "Say it right": the whole camera picture (never cropped or zoomed to fill the screen), the shutter
// in the middle, the gallery on the left, a Lens button on the right when the phone has several back cameras, and a
// torch where it has one. The photo is a real photograph where the browser can take one (focused, full detail), else
// the picture on screen. While the page is read the photo stays up; if it can't be read, the camera comes back with
// the reason — and a button when there is something to do about it. A setup problem found before the first photo
// (`blocked`: no access code, a refused key) is shown instead of letting the learner photograph in vain, and the
// camera is switched off meanwhile. A browser that won't show a camera here (blocked, none, too old) offers the
// phone's own camera app and the gallery instead. Closing — the ×, Escape, the phone's Back button — stops the
// camera and cancels whatever was being taken or read.

type Cam = 'starting' | 'live' | 'blocked' | 'none' | 'failed';
const CAM_PROBLEM: Record<Exclude<Cam, 'starting' | 'live'>, Key> = {
  blocked: 'home.camera.problem.blocked',
  none: 'home.camera.problem.none',
  failed: 'home.camera.problem.failed',
};
const nameOf = (e: unknown): string => (e as { name?: string } | null)?.name ?? '';
const problemOf = (e: unknown): Cam => (nameOf(e) === 'NotAllowedError' || nameOf(e) === 'SecurityError' ? 'blocked' : nameOf(e) === 'NotFoundError' ? 'none' : 'failed');
/** This lens won't open, but another may: gone, unsuitable, or busy. Never a refused permission — asking again would nag. */
const lensTrouble = (e: unknown): boolean => ['OverconstrainedError', 'NotFoundError', 'NotReadableError', 'AbortError'].includes(nameOf(e));
const FIX_LABEL: Record<NonNullable<Problem['fix']>, Key> = { code: 'home.camera.fix.code', connections: 'home.camera.fix.connections' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const { t } = useT();
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  /** One per opening of the camera: closing cancels the photo being taken, shrunk, sent or read. */
  const session = useRef<AbortController | null>(null);
  const control = useRef<{ pause: () => void; resume: () => void; lens: (deviceId: string) => void } | null>(null);
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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const c = new AbortController();
    session.current = c;
    return () => c.abort();
  }, []);

  // ---- the camera itself
  useEffect(() => {
    if (!canShowCamera()) return;
    // `newest`: every start gets a number, and only the newest may keep its stream — starts overlap (a lens switch
    // while the first camera is still opening, coming back from another app) and a stream nobody holds would leave
    // the camera on after the screen is closed.
    const run = { gone: false, newest: 0, starting: 0, wanted: true, hadLive: false, lastGood: undefined as string | undefined, bad: new Set<string>() };
    let stream: MediaStream | null = null;
    const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; track.current = null; };

    /** Torch, zoom and focus only show up once the camera is really streaming — and on some phones a moment later. */
    const tune = async (t: MediaStreamTrack, mine: number) => {
      for (const wait of [0, 500]) {
        if (wait) await sleep(wait);
        if (run.gone || mine !== run.newest || t.readyState !== 'live') return;
        const caps = (t.getCapabilities?.() ?? {}) as { torch?: boolean; zoom?: { min: number; max: number }; focusMode?: string[] };
        if (!caps.torch && !caps.zoom && !caps.focusMode && !wait) continue;
        if (caps.torch) setTorch(false);
        // Never start zoomed in, and keep refocusing as the page moves closer (print is small).
        const zoom = (t.getSettings() as { zoom?: number }).zoom;
        const plain = caps.zoom ? Math.max(caps.zoom.min, 1) : null;
        if (plain != null && zoom != null && zoom > plain) await t.applyConstraints({ advanced: [{ zoom: plain } as MediaTrackConstraintSet] }).catch(() => undefined);
        if (caps.focusMode?.includes('continuous')) await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
        return;
      }
    };

    /** Open a lens (or the browser's back camera) at its widest: 4:3 is the whole sensor; 16:9 cuts it. Null: superseded. */
    const start = async (deviceId?: string): Promise<MediaStreamTrack | null> => {
      const mine = ++run.newest;
      run.starting++;
      setCam('starting');
      setTorch(null);
      stop();
      try {
        const shape = { width: { ideal: 2560 }, height: { ideal: 1920 }, aspectRatio: { ideal: 4 / 3 } };
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, ...shape } : { facingMode: { ideal: 'environment' }, ...shape } });
        const t = s.getVideoTracks()[0];
        if (run.gone || mine !== run.newest || !run.wanted || !t) { s.getTracks().forEach((x) => x.stop()); if (!t && mine === run.newest && !run.gone) setCam('failed'); return null; }
        stream = s;
        track.current = t;
        t.addEventListener('ended', () => { if (track.current === t) void revive(); }); // the phone took the camera away
        const v = video.current;
        if (v) {
          v.srcObject = s;
          try { await v.play(); } catch (e) { if (mine === run.newest && !run.gone) throw e; } // a newer start replaced the picture
        }
        if (run.gone || mine !== run.newest) return null;
        const settings = t.getSettings();
        // A camera facing the learner (a laptop's: no facing reported, no touch screen) is shown like a mirror; the
        // photo itself never is.
        setMirror(settings.facingMode === 'user' || (!settings.facingMode && !navigator.maxTouchPoints));
        setLens(settings.deviceId ?? null);
        setCam('live');
        run.hadLive = true;
        run.lastGood = settings.deviceId ?? run.lastGood;
        void tune(t, mine);
        return t;
      } finally {
        run.starting--;
      }
    };

    /** A lens that won't open is skipped from then on, and the last one that worked comes back. */
    const openLens = async (deviceId: string, keep: boolean): Promise<boolean> => {
      try {
        const t = await start(deviceId);
        if (t && keep) rememberLens(deviceId);
        return !!t;
      } catch (e) {
        if (run.gone) return false;
        if (!lensTrouble(e)) { setCam(problemOf(e)); return false; }
        run.bad.add(deviceId);
        setLenses((all) => all.filter((l) => !run.bad.has(l.deviceId)));
        if (rememberedLens() === deviceId) forgetLens();
        try { await start(run.lastGood && !run.bad.has(run.lastGood) ? run.lastGood : undefined); } catch (again) { if (!run.gone) setCam(problemOf(again)); }
        return false;
      }
    };

    /** Back from another app, or the phone took the camera (its own camera app, a call): a dead picture is restarted. */
    const revive = async () => {
      if (run.gone || !run.wanted || !run.hadLive || run.starting > 0 || document.visibilityState !== 'visible') return;
      const t = stream?.getVideoTracks()[0];
      if (t?.readyState === 'live') {
        if (!t.muted) return;
        await sleep(1000); // an iPhone un-mutes the picture by itself a moment after coming back
        if (run.gone || run.starting > 0 || stream?.getVideoTracks()[0] !== t || !t.muted) return;
      }
      try { await start(run.lastGood); } catch (e) { if (!run.gone) setCam(problemOf(e)); }
    };
    const onVisible = () => { void revive(); };
    document.addEventListener('visibilitychange', onVisible);

    control.current = {
      // A setup problem is on screen: no reason to keep the camera (and its light) on.
      pause: () => { if (!run.wanted) return; run.wanted = false; run.newest++; stop(); },
      resume: () => { if (run.wanted) return; run.wanted = true; void start(run.lastGood).catch((e) => { if (!run.gone) setCam(problemOf(e)); }); },
      lens: (deviceId) => { void openLens(deviceId, true); },
    };

    (async () => {
      try {
        const remembered = rememberedLens();
        let t: MediaStreamTrack | null = null;
        if (remembered) {
          try { t = await start(remembered); } catch (e) { if (!lensTrouble(e)) throw e; forgetLens(); }
        }
        if (!t && !run.gone && run.wanted && run.starting === 0) t = await start();
        if (!t || run.gone) return;
        // Now that the camera is allowed, the lenses have names: open the main one if the browser chose another.
        const backs = backLenses(await navigator.mediaDevices.enumerateDevices());
        if (run.gone) return;
        setLenses(backs.filter((l) => !run.bad.has(l.deviceId)));
        const want = pickLens(backs, rememberedLens());
        if (want && want.deviceId !== t.getSettings().deviceId && track.current === t) await openLens(want.deviceId, false);
        // Remembered, so the next opening goes straight to it: one camera start, not two.
        const now = track.current?.getSettings().deviceId;
        if (!run.gone && now && backs.some((l) => l.deviceId === now)) rememberLens(now);
      } catch (e) {
        if (!run.gone) setCam(problemOf(e));
      }
    })();

    return () => { run.gone = true; stop(); control.current = null; document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // ---- a dialog: nothing behind it can be reached, focus starts inside and goes back where it came from
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const behind = document.getElementById('app-frame');
    behind?.setAttribute('inert', '');
    root.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); behind?.removeAttribute('inert'); before?.focus?.(); };
  }, []);

  // A setup problem that arrives while a photo is being taken or read waits until that is over.
  const stopped = blocked && !shot && !taking ? blocked : null;
  const isStopped = !!stopped;
  useEffect(() => { if (isStopped) control.current?.pause(); else control.current?.resume(); }, [isStopped]);

  const live = cam === 'live';
  const idle = !shot && !taking && !stopped;
  // The shutter is where the keyboard (and a screen reader) should be whenever a photo can be taken.
  useEffect(() => { if (live && idle) shutter.current?.focus(); }, [live, idle]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot); }, [shot]);

  const readPhoto = async (photo: Blob) => {
    const signal = session.current?.signal;
    if (!signal || signal.aborted) return;
    setProblem(null);
    setShot(URL.createObjectURL(photo));
    const why = await read(photo, signal);
    if (signal.aborted) return;
    if (why) { setProblem(why); setShot(null); }
  };

  const take = async () => {
    const v = video.current, signal = session.current?.signal;
    if (!v?.videoWidth || !signal || signal.aborted || !idle) return;
    setTaking(true);
    setProblem(null);
    try {
      const photo = await takeStill(track.current, v);
      if (signal.aborted) return; // closed while the phone was taking it: nothing is sent
      if (photo) void readPhoto(photo); else setProblem({ text: t('home.camera.noPicture') });
    } finally {
      if (!signal.aborted) setTaking(false);
    }
  };

  const flip = async () => {
    const t = track.current;
    if (!t || torch === null) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setTorch(null); }
  };

  const trouble = cam !== 'starting' && cam !== 'live' ? t(CAM_PROBLEM[cam]) : null;
  const at = lenses.findIndex((l) => l.deviceId === lens);
  const nextLens = lenses.length > 1 ? lenses[(at + 1) % lenses.length] : null;
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readPhoto(f); };
  const fixButton = (p: Problem) => p.fix && <button type="button" className="camera__app" onClick={() => onFix(p.fix!)}>{t(FIX_LABEL[p.fix])}</button>;

  return createPortal(
    <div ref={root} className="camera" role="dialog" aria-modal="true" aria-label={t('home.camera.aria')} tabIndex={-1}>
      <video ref={video} className={`camera__video ${mirror ? 'camera__video--mirror' : ''} ${live && !stopped ? '' : 'camera__video--off'}`} playsInline muted aria-hidden />
      {shot && <img className="camera__shot" src={shot} alt="" />}
      {(shot || taking) && <div className="camera__reading" role="status">{shot && <span className="camera__scan" aria-hidden />}<span className="camera__pill">{t(taking ? 'home.camera.holdStill' : kid ? 'home.camera.reading.kid' : 'home.camera.reading.adult')}</span></div>}

      <div className="camera__top">
        <button type="button" className="camera__round" aria-label={t('home.camera.close')} onClick={onClose}><Icon name="close" /></button>
        <span className="camera__title">{t('home.camera.title')}</span>
        {torch !== null && live && !stopped ? (
          <button type="button" className={`camera__round ${torch ? 'is-on' : ''}`} aria-label={t(torch ? 'home.camera.torch.off' : 'home.camera.torch.on')} aria-pressed={torch} onClick={() => void flip()}><Icon name="bolt" fill={torch} /></button>
        ) : <span className="camera__round camera__round--empty" />}
      </div>

      {stopped ? (
        <div className="camera__middle" role="alert"><p>{stopped.text}</p>{fixButton(stopped)}</div>
      ) : (
        <>
          {problem && !shot && <div className="camera__problem" role="alert"><p>{problem.text}</p>{fixButton(problem)}</div>}
          {cam === 'starting' && !shot && <p className="camera__middle">{t('home.camera.starting')}</p>}
          {trouble && !shot && (
            <div className="camera__middle">
              <p>{trouble}</p>
              {cam !== 'none' && <button type="button" className="camera__app" onClick={() => cameraApp.current?.click()}><Icon name="camera" size={20} />{t('home.camera.useApp')}</button>}
            </div>
          )}
        </>
      )}

      <div className="camera__bottom">
        {live && idle && !problem && <p className="camera__hint camera__pill">{t(kid ? 'home.camera.hint.kid' : 'home.camera.hint.adult')}</p>}
        {/* Always a way out to the phone's own camera (best focus, flash, every lens) if this preview looks blurry. */}
        {live && idle && navigator.maxTouchPoints > 0 && <button type="button" className="camera__link camera__pill" onClick={() => cameraApp.current?.click()}>{t('home.camera.blurry')}</button>}
        <div className="camera__bar">
          <button type="button" className="camera__side" onClick={() => gallery.current?.click()} disabled={!idle}>
            <span className="camera__round"><Icon name="image" /></span><small>{t('home.camera.photos')}</small>
          </button>
          <button ref={shutter} type="button" className="camera__shutter" aria-label={t('home.camera.shutter')} onClick={() => void take()} disabled={!live || !idle} />
          {nextLens && !stopped ? (
            <button type="button" className="camera__side" onClick={() => control.current?.lens(nextLens.deviceId)} disabled={!idle || !live} aria-label={t('home.camera.lens.aria', { n: Math.max(at, 0) + 1, total: lenses.length })}>
              <span className="camera__round"><Icon name="retry" /></span><small>{t('home.camera.lens', { n: Math.max(at, 0) + 1, total: lenses.length })}</small>
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
