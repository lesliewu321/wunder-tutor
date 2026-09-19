import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGrownUp } from '../../domain/types';
import { apiHealth } from '../../speech/health';
import { readPhoto } from '../../speech/read';
import { useProfile } from '../../state/store';
import { toast } from '../../ui/kit';
import { CameraScreen } from './CameraScreen';
import { onOpenCamera } from './camera';
import { readErrorMessage, readingProblem } from './messages';
import { saveMode, savePage } from './page';

// The one camera screen, opened from anywhere with openCamera(). A page that is read becomes the learner's book page,
// and Home switches to "My book" to show its sentences.
export function CameraHost() {
  const nav = useNavigate();
  const p = useProfile();
  const [open, setOpen] = useState(false);

  useEffect(() => onOpenCamera(() => {
    void apiHealth().then((h) => {
      if (h.read) return setOpen(true);
      // Without the API a photo can't be read: say so before the learner takes one.
      toast(h.needsCode ? 'Reading pages needs the beta access code — a grown-up can add it under Beta access in the settings.' : 'Reading pages isn’t available right now. Try again later.', '🔒');
    });
  }), []);

  if (!open || !p) return null;
  const kid = !isGrownUp(p.band);
  return (
    <CameraScreen kid={kid} onClose={() => setOpen(false)} read={async (photo, signal) => {
      try {
        const reading = await readPhoto(photo, signal);
        const problem = readingProblem(reading, kid);
        if (problem) return problem;
        savePage(p.id, { reading, best: {}, at: Date.now() });
        saveMode(p.id, 'book');
        setOpen(false);
        nav('/');
        return null;
      } catch (e) {
        return signal.aborted ? null : readErrorMessage(e);
      }
    }} />
  );
}
