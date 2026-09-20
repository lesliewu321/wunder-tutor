import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isGrownUp } from '../../domain/types';
import { useT } from '../../i18n/useT';
import { getAccessCode, refreshHealth, serviceStatus } from '../../speech/health';
import { ReadError, readPhoto } from '../../speech/read';
import { useProfile } from '../../state/store';
import { CameraScreen } from './CameraScreen';
import { onOpenCamera } from './camera';
import { readProblem, readingProblem, setupProblem, type Problem } from './messages';
import { saveMode, savePage } from './page';

// The one camera screen, opened from anywhere with openCamera(). Being open is a step in the browser's history
// (`state.camera` on the page the learner was on), so the phone's Back button closes the camera instead of leaving
// the page behind it — or the app. A page that is read becomes the learner's book page, and Home switches to "My
// book" to show its sentences.
export function CameraHost() {
  useT(); // no wording of its own, but it passes on lines from messages.ts, which are in the app's language
  const nav = useNavigate();
  const loc = useLocation();
  const p = useProfile();
  const inHistory = (loc.state as { camera?: boolean } | null)?.camera === true;
  /** Opened by a tap in this visit — not found in the history after a reload, which must not switch the camera on. */
  const tapped = useRef(false);
  const open = inHistory && tapped.current;
  const [blocked, setBlocked] = useState<Problem | null>(null);

  useEffect(() => onOpenCamera(() => {
    if (tapped.current) return; // already open
    tapped.current = true;
    nav(window.location.pathname + window.location.search, { state: { camera: true } });
  }), [nav]);
  useEffect(() => {
    if (inHistory && !tapped.current) nav(loc.pathname + loc.search, { replace: true, state: null });
    if (!inHistory) tapped.current = false;
  }, [inHistory, loc.pathname, loc.search, nav]);

  // While the camera starts: can this device read pages at all? Asked fresh every time (the code or the server's
  // keys may have changed since the app opened), so a setup problem shows before the photo, not after it.
  useEffect(() => {
    if (!open) return;
    let gone = false;
    setBlocked(null);
    void (async () => {
      const health = await refreshHealth();
      if (gone) return;
      const early = setupProblem(health, !!getAccessCode(), null);
      if (early || !health.read) return setBlocked(early);
      const status = await serviceStatus();
      if (!gone) setBlocked(setupProblem(health, !!getAccessCode(), status));
    })();
    return () => { gone = true; };
  }, [open]);

  if (!open || !p) return null;
  const kid = !isGrownUp(p.band);
  return (
    <CameraScreen kid={kid} blocked={blocked} onClose={() => nav(-1)}
      onFix={(show) => nav('/parents', { replace: true, state: { show } })}
      read={async (photo, signal) => {
        try {
          const reading = await readPhoto(photo, signal);
          if (signal.aborted) return null; // closed meanwhile: the page the learner has is not replaced
          const nothing = readingProblem(reading, kid);
          if (nothing) return { text: nothing };
          savePage(p.id, { reading, best: {}, at: Date.now() });
          saveMode(p.id, 'book');
          nav('/', { replace: true }); // Home takes the camera's place in the history
          return null;
        } catch (e) {
          if (signal.aborted || (e instanceof ReadError && e.code === 'cancelled')) return null;
          // The code was refused: the rest of the app should know too (practice-mode banners, the teacher voice).
          if (e instanceof ReadError && (e.code === 'locked' || e.code === 'lockout')) void refreshHealth();
          return readProblem(e);
        }
      }} />
  );
}
