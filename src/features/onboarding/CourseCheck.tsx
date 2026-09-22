import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contentBand, type CourseId } from '../../domain/types';
import { ASSESSMENT_ITEMS } from '../../content/course';
import { phonemeInfo } from '../../content/phonemes';
import { FR_CHECK_ITEMS } from '../../content/fr/course';
import { JA_CHECK_ITEMS } from '../../content/ja/course';
import { ZH_CHECK_ITEMS } from '../../content/zh/course';
import { useT } from '../../i18n/useT';
import { inCourse, labOrder, WEAK_BELOW } from '../../intelligence/profile';
import { useActiveProfile, useStore } from '../../state/store';
import { Button, IconButton, ProgressBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { SpeakExercise } from '../speak/SpeakExercise';

/** A one-minute speaking check the first time a learner opens a course, so the plan starts from what Tutu heard. */
export function CourseCheck() {
  const { t, tc } = useT();
  const nav = useNavigate();
  const { course = 'zh' } = useParams();
  const p = useActiveProfile();
  const patch = useStore((s) => s.patchProfile);
  const courseId: CourseId = course === 'zh' || course === 'fr' || course === 'ja' ? course : 'en';
  const items = (courseId === 'zh' ? ZH_CHECK_ITEMS : courseId === 'fr' ? FR_CHECK_ITEMS : courseId === 'ja' ? JA_CHECK_ITEMS : ASSESSMENT_ITEMS)[contentBand(p.band)];
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    const zh = course === 'zh';
    const heard = Object.values(p.pronunciation.phonemes).filter((s) => inCourse(s.phoneme, courseId) && s.ema < WEAK_BELOW).sort((a, b) => a.ema - b.ema).map((s) => s.phoneme);
    const focus = [...new Set([...heard, ...labOrder(p.pronunciation, p.homeLanguage, courseId)])].slice(0, 3);
    return (
      <div className="screen onboard">
        <div className="onboard__body">
          <Mascot mood="happy" size={96} />
          <h1 className="onboard__title">{t(zh ? 'onboarding.check.title.zh' : 'onboarding.check.title.en')}</h1>
          <p className="onboard__sub">{t(p.band === 'adult' ? 'onboarding.plan.sub.adult' : 'onboarding.plan.sub.child')}</p>
          <div className="card plan">
            <h2>{t('onboarding.check.startWith')}</h2>
            <div className="plan__sounds">{focus.map((ph) => <span key={ph} className="sound-badge sound-badge--weak"><b>{phonemeInfo(ph).label}</b><small>{tc(`sound.${ph}.name`, phonemeInfo(ph).name)}</small></span>)}</div>
          </div>
          <p className="hint">{t('onboarding.check.hint')}</p>
        </div>
        <div className="onboard__dock"><Button size="lg" block onClick={() => nav('/', { replace: true })}>{t('onboarding.plan.start')}</Button></div>
      </div>
    );
  }

  const item = items[index];
  // A way out that was missing (a tester: "Back button missing in pages"): back to where the check was opened from.
  const leave = () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : nav('/', { replace: true }));
  return (
    <div className="screen lesson">
      <header className="lesson__bar"><IconButton icon="close" label={t('common.close')} onClick={leave} /><ProgressBar value={index / items.length} tone="leaf" /><span className="lesson__count">{index + 1}/{items.length}</span></header>
      <div className="lesson__body" key={item.id}>
        <SpeakExercise item={item} context="onboarding" mode="check" onDone={() => {
          if (index + 1 < items.length) return setIndex(index + 1);
          if (course === 'zh') patch(p.id, { zhChecked: true });
          setDone(true);
        }} />
      </div>
    </div>
  );
}
