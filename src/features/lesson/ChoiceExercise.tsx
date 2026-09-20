import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, SpeakItem } from '../../domain/types';
import { phonemeInfo } from '../../content/phonemes';
import { useT } from '../../i18n/useT';
import { localeOf, stopPlayback, voice } from '../../speech/voice';
import { useActiveProfile } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, toast } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { ZhText } from '../../ui/ZhText';

type ChoiceEx = Extract<Exercise, { type: 'choose-heard' | 'minimal-pair' }>;

const shuffle = <T,>(xs: T[], seed: string): T[] => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [...xs].map((x, i) => ({ x, k: Math.sin(h + i * 7.3) })).sort((a, b) => a.k - b.k).map((o) => o.x);
};

/** Listening exercises: "choose what you heard" and minimal pairs (three / tree). */
export function ChoiceExercise({ ex, onDone }: { ex: ChoiceEx; onDone: (firstTry: boolean) => void }) {
  const { t } = useT();
  const profile = useActiveProfile();
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true);

  const answer: SpeakItem = ex.type === 'choose-heard' ? ex.answer : ex.pair[ex.answerIndex];
  const options = useMemo(() => (ex.type === 'choose-heard' ? shuffle(ex.options, ex.id) : ex.pair), [ex]);
  const solved = picked === answer.id;
  const canHear = voice.available();

  const locale = localeOf(answer, profile.accent);
  const say = async (text: string, slow = false) => {
    setPlaying(true);
    try { await voice.speak(text, { accent: locale, slow }); } catch { toast(t('lesson.choice.noSound.toast'), '🔇'); }
    if (alive.current) setPlaying(false);
  };

  useEffect(() => {
    alive.current = true;
    setPicked(null); setWrong([]);
    const timer = setTimeout(() => void say(answer.text), 450);
    return () => { alive.current = false; clearTimeout(timer); stopPlayback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id]);

  const choose = (it: SpeakItem) => {
    if (solved) return;
    if (it.id === answer.id) {
      setPicked(it.id);
      if (ex.type === 'minimal-pair') void say(answer.lang ? `${ex.pair[0].text}，${ex.pair[1].text}。` : `${ex.pair[0].text}. ${ex.pair[1].text}.`, true);
    } else {
      setWrong((w) => [...w, it.id]);
      void say(answer.text, true);
    }
  };

  // Mandarin: characters with pinyin are the whole point (a tone pair differs only in its mark), so always show them.
  const showText = profile.band !== 'little' || options.some((o) => !o.picture) || !!answer.zh;
  const sound = ex.type === 'minimal-pair' ? phonemeInfo(ex.focus) : null;

  return (
    <div className="choice">
      <div className="choice__stage">
        <h2 className="choice__title">{t(ex.type === 'minimal-pair' ? 'lesson.choice.title.pair' : 'lesson.choice.title.heard')}</h2>
        {sound && profile.band !== 'little' && <p className="choice__sub">{sound.category === 'tone' ? t('lesson.choice.listenFor.tone', { name: sound.name.toLowerCase() }) : t('lesson.choice.listenFor.sound', { label: sound.label })}</p>}
        <button type="button" className={`bigplay ${playing ? 'is-playing' : ''}`} onClick={() => void say(answer.text)} aria-label={t('lesson.choice.replay')}>
          <Icon name="speaker" size={40} />
        </button>
        <button type="button" className="pill pill--sm" onClick={() => void say(answer.text, true)}><Icon name="turtle" size={18} />{t('common.slow')}</button>
        {!canHear && <p className="choice__sub">{t('lesson.choice.noSound.skip')}</p>}

        <div className={`options options--${options.length}`}>
          {options.map((o) => {
            const state = solved && o.id === answer.id ? 'right' : wrong.includes(o.id) ? 'wrong' : '';
            return (
              <button key={o.id} type="button" className={`option option--${state} ${o.picture && o.text.length <= 14 ? '' : 'option--text'}`} onClick={() => choose(o)} disabled={wrong.includes(o.id)}>
                {o.picture && <span className="option__pic" aria-hidden>{o.picture}</span>}
                {showText && <span className="option__text">{o.zh ? <ZhText item={o} script={profile.zhScript} /> : o.text}</span>}
                {!showText && <span className="sr-only">{o.text}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="choice__dock">
        {solved ? (
          <>
            <div className="choice__cheer"><Mascot mood="happy" size={72} /><p>{t(wrong.length ? 'lesson.choice.cheer.retry' : 'lesson.choice.cheer.first')}</p></div>
            <Button variant="leaf" size="lg" block onClick={() => onDone(wrong.length === 0)}>{t('common.continue')}</Button>
          </>
        ) : wrong.length > 0 ? (
          <p className="choice__nudge">{t('lesson.choice.nudge')}</p>
        ) : !canHear ? (
          <Button variant="ghost" block onClick={() => onDone(true)}>{t('lesson.choice.skip')}</Button>
        ) : null}
      </div>
    </div>
  );
}
