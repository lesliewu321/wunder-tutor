import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, SpeakItem } from '../../domain/types';
import { phonemeInfo } from '../../content/phonemes';
import { stopPlayback, voice } from '../../speech/voice';
import { useActiveProfile } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, toast } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';

type ChoiceEx = Extract<Exercise, { type: 'choose-heard' | 'minimal-pair' }>;

const shuffle = <T,>(xs: T[], seed: string): T[] => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [...xs].map((x, i) => ({ x, k: Math.sin(h + i * 7.3) })).sort((a, b) => a.k - b.k).map((o) => o.x);
};

/** Listening exercises: "choose what you heard" and minimal pairs (three / tree). */
export function ChoiceExercise({ ex, onDone }: { ex: ChoiceEx; onDone: (firstTry: boolean) => void }) {
  const profile = useActiveProfile();
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true);

  const answer: SpeakItem = ex.type === 'choose-heard' ? ex.answer : ex.pair[ex.answerIndex];
  const options = useMemo(() => (ex.type === 'choose-heard' ? shuffle(ex.options, ex.id) : ex.pair), [ex]);
  const solved = picked === answer.id;
  const canHear = voice.available();

  const say = async (text: string, slow = false) => {
    setPlaying(true);
    try { await voice.speak(text, { accent: profile.accent, slow }); } catch { toast('Sound isn’t working on this device right now', '🔇'); }
    if (alive.current) setPlaying(false);
  };

  useEffect(() => {
    alive.current = true;
    setPicked(null); setWrong([]);
    const t = setTimeout(() => void say(answer.text), 450);
    return () => { alive.current = false; clearTimeout(t); stopPlayback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id]);

  const choose = (it: SpeakItem) => {
    if (solved) return;
    if (it.id === answer.id) {
      setPicked(it.id);
      if (ex.type === 'minimal-pair') void say(`${ex.pair[0].text}. ${ex.pair[1].text}.`, true);
    } else {
      setWrong((w) => [...w, it.id]);
      void say(answer.text, true);
    }
  };

  const showText = profile.band !== 'little' || options.some((o) => !o.picture);
  const sound = ex.type === 'minimal-pair' ? phonemeInfo(ex.focus) : null;

  return (
    <div className="choice">
      <div className="choice__stage">
        <h2 className="choice__title">{ex.type === 'minimal-pair' ? 'Which one did you hear?' : 'What did you hear?'}</h2>
        {sound && profile.band !== 'little' && <p className="choice__sub">Listen for the “{sound.label}” sound.</p>}
        <button type="button" className={`bigplay ${playing ? 'is-playing' : ''}`} onClick={() => void say(answer.text)} aria-label="Play the sound again">
          <Icon name="speaker" size={40} />
        </button>
        <button type="button" className="pill pill--sm" onClick={() => void say(answer.text, true)}><Icon name="turtle" size={18} />Slow</button>
        {!canHear && <p className="choice__sub">Sound isn’t available on this device, so you can skip this one.</p>}

        <div className={`options options--${options.length}`}>
          {options.map((o) => {
            const state = solved && o.id === answer.id ? 'right' : wrong.includes(o.id) ? 'wrong' : '';
            return (
              <button key={o.id} type="button" className={`option option--${state} ${o.picture && o.text.length <= 14 ? '' : 'option--text'}`} onClick={() => choose(o)} disabled={wrong.includes(o.id)}>
                {o.picture && <span className="option__pic" aria-hidden>{o.picture}</span>}
                {showText && <span className="option__text">{o.text}</span>}
                {!showText && <span className="sr-only">{o.text}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="choice__dock">
        {solved ? (
          <>
            <div className="choice__cheer"><Mascot mood="happy" size={72} /><p>{wrong.length ? 'You got it!' : 'Great listening!'}</p></div>
            <Button variant="leaf" size="lg" block onClick={() => onDone(wrong.length === 0)}>Continue</Button>
          </>
        ) : wrong.length > 0 ? (
          <p className="choice__nudge">Not quite — listen again, nice and slow.</p>
        ) : !canHear ? (
          <Button variant="ghost" block onClick={() => onDone(true)}>Skip</Button>
        ) : null}
      </div>
    </div>
  );
}
