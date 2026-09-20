import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGrownUp } from '../../domain/types';
import { getAccessCode, refreshHealth, serviceStatus } from '../../speech/health';
import { ReadError, readPhoto } from '../../speech/read';
import { useProfile } from '../../state/store';
import { CameraScreen } from './CameraScreen';
import { onOpenCamera } from './camera';
import { readProblem, readingProblem, setupProblem, type Problem } from './messages';
import { saveMode, savePage } from './page';

// The one camera screen, opened from anywhere with openCamera(). A page that is read becomes the learner's book page,
// and Home switches to "My book" to show its sentences.
export function CameraHost() {
  const nav = useNavigate();
  const p = useProfile();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<Problem | null>(null);

  useEffect(() => onOpenCamera(() => { setBlocked(null); setOpen(true); }), []);

  // While the camera starts: can this device read pages at all? Asked fresh every time (the code or the server's
  // keys may have changed since the app opened), so a setup problem shows before the photo, not after it.
  useEffect(() => {
    if (!open) return;
    let gone = false;
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
    <CameraScreen kid={kid} blocked={blocked} onClose={() => setOpen(false)}
      onFix={(show) => { setOpen(false); nav('/parents', { state: { show } }); }}
      read={async (photo, signal) => {
        try {
          const reading = await readPhoto(photo, signal);
          const nothing = readingProblem(reading, kid);
          if (nothing) return { text: nothing };
          savePage(p.id, { reading, best: {}, at: Date.now() });
          saveMode(p.id, 'book');
          setOpen(false);
          nav('/');
          return null;
        } catch (e) {
          if (signal.aborted) return null;
          // The code was refused: the rest of the app should know too (practice-mode banners, the teacher voice).
          if (e instanceof ReadError && e.code === 'locked') void refreshHealth();
          return readProblem(e);
        }
      }} />
  );
}
