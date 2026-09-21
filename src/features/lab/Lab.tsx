import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isGrownUp, type ChildProfile, type PhonemeId } from '../../domain/types';
import { LADDERS, LAB_STAGES, stageLabel, type LabStage } from '../../content/lab';
import { exampleSpeech, isJaSound, isLongLabel, isZhSound, phonemeInfo, soundLocale, tipFor } from '../../content/phonemes';
import { shownText } from '../../content/zh/script';
import { XP, badgeName } from '../../engine/rewards';
import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { labOrder, MASTERED_AT, WEAK_BELOW } from '../../intelligence/profile';
import { noSoundMessage } from '../../speech/health';
import { voice } from '../../speech/voice';
import { ToneContour } from '../../ui/ToneContour';
import { useActiveProfile, useStore } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, ProgressBar, toast, TopBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { Mouth } from '../../ui/Mouth';
import { SpeakExercise } from '../speak/SpeakExercise';

/** How a sound is going. `label` is the key of the line that says so — wording is looked up when it is shown. */
const status = (p: ChildProfile, id: PhonemeId): { key: 'new' | 'good' | 'okay' | 'weak'; label: Key; score: number | null } => {
  const s = p.pronunciation.phonemes[id];
  if (!s || s.count < 2) return { key: 'new', label: 'lab.status.new', score: null };
  const score = Math.round(s.ema);
  if (s.masteredAt) return { key: 'good', label: 'lab.status.mastered', score };
  if (s.ema >= MASTERED_AT) return { key: 'good', label: 'lab.status.great', score };
  if (s.ema < WEAK_BELOW) return { key: 'weak', label: 'lab.status.weak', score };
  return { key: 'okay', label: 'lab.status.better', score };
};

/**
 * Each rung's whole lines — a rung's name is never glued into a sentence (src/i18n/README.md, rule 3).
 * `next` is said when that rung is the one to climb next; the first rung never is.
 */
const STAGE_LINES: Record<LabStage, { practise: Key; done: Key; next?: Key }> = {
  syllables: { practise: 'lab.sound.practise.syllables', done: 'lab.stage.done.syllables' },
  words: { practise: 'lab.sound.practise.words', done: 'lab.stage.done.words', next: 'lab.stage.next.words' },
  phrases: { practise: 'lab.sound.practise.phrases', done: 'lab.stage.done.phrases', next: 'lab.stage.next.phrases' },
  sentence: { practise: 'lab.sound.practise.sentence', done: 'lab.stage.done.sentence', next: 'lab.stage.next.sentence' },
};

/** A line whose **bold** part is a score, shown in the score's colour (`rich` in i18n/useT makes plain bold only). */
const scoreLine = (text: string, tone: string): ReactNode => {
  const [before, score, after] = text.split('**');
  return <>{before}<b className={`score-text score-text--${tone}`}>{score}</b>{after}</>;
};

const stageDone = (p: ChildProfile, sound: PhonemeId, stage: LabStage) => LADDERS[sound][stage].filter((it) => p.items[it.id]?.mastered).length;

export function LabHome() {
  const { t } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const order = labOrder(p.pronunciation, p.homeLanguage, p.course);
  return (
    <div className="screen lab">
      <TopBar title={t('lab.title')} />
      <p className="lead">{t(p.course === 'zh' ? 'lab.home.lead.zh' : 'lab.home.lead.en')}</p>
      <ul className="sound-list">
        {order.map((id, i) => {
          const info = phonemeInfo(id);
          const st = status(p, id);
          const total = LAB_STAGES.reduce((n, s) => n + LADDERS[id][s].length, 0);
          const done = LAB_STAGES.reduce((n, s) => n + stageDone(p, id, s), 0);
          return (
            <li key={id}>
              <button type="button" className={`sound-card sound-card--${st.key}`} onClick={() => nav(`/lab/${encodeURIComponent(id)}`)}>
                <span className="sound-card__glyph" data-long={isLongLabel(info.label) || undefined}>{info.label}</span>
                <span className="sound-card__text">
                  <b>{info.name}</b>
                  <small>{t('lab.home.asIn', { example: info.example })}{isGrownUp(p.band) && !isZhSound(id) && !isJaSound(id) ? ` · /${id}/` : ''}</small>
                  <ProgressBar value={done / total} tone="leaf" />
                </span>
                <span className="sound-card__side">
                  {st.score != null ? <b className={`score-text score-text--${st.key}`}>{st.score}</b> : <Icon name="chevron" size={20} />}
                  <small>{t(i === 0 && st.key !== 'good' ? 'lab.home.startHere' : st.label)}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LabSound() {
  const { t } = useT();
  const nav = useNavigate();
  const { sound = '' } = useParams();
  const p = useActiveProfile();
  const ladder = LADDERS[sound];
  const info = phonemeInfo(sound);
  if (!ladder) return <div className="screen screen--center"><p>{t('lab.sound.missing')}</p><Button onClick={() => nav('/lab')}>{t('lab.back.lab')}</Button></div>;

  const st = status(p, sound);
  const nextStage = LAB_STAGES.find((s) => stageDone(p, sound, s) < ladder[s].length) ?? 'sentence';
  // A Mandarin tone or a Japanese beat has no IPA symbol worth showing; each example is said in its own language.
  const noSymbol = isZhSound(sound) || isJaSound(sound);
  const say = (slow: boolean) => void voice.speak(exampleSpeech(sound), { accent: soundLocale(sound, p.accent), slow }).catch((e) => void noSoundMessage(p.band, e).then((m) => toast(m, '🔇')));

  return (
    <div className="screen lab-sound">
      <TopBar title={info.name} onBack={() => nav('/lab')} />
      <section className="card guide">
        <div className="guide__top">
          <div className="guide__glyph" data-long={isLongLabel(info.label) || undefined}><b>{info.label}</b>{p.band !== 'little' && !noSymbol && <small>/{sound}/</small>}</div>
          {info.category === 'tone' ? <ToneContour tone={Number(sound.slice(-1)) as 1 | 2 | 3 | 4} size={190} /> : <Mouth pose={info.pose} size={190} />}
        </div>
        <p className="guide__tip">{tipFor(sound, p.band)}</p>
        <ul className="steps">
          {info.steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
          {info.category !== 'tone' && <li className={info.pose.voiced ? 'steps__voice on' : 'steps__voice'}><span>{info.pose.voiced ? '〰' : '·'}</span>{t(info.pose.voiced ? 'lab.sound.voice.on' : 'lab.sound.voice.off')}</li>}
        </ul>
        <div className="listen-row">
          <button type="button" className="pill" onClick={() => say(false)}><Icon name="speaker" size={20} />{t('lab.sound.listen.example', { example: info.example })}</button>
          <button type="button" className="pill" onClick={() => say(true)}><Icon name="turtle" size={20} />{t('common.slow')}</button>
        </div>
        {st.score != null && <p className="guide__score">{scoreLine(t('lab.sound.score', { label: info.label, score: st.score, status: t(st.label) }), st.key)}</p>}
      </section>

      <h2 className="section-title">{t('lab.sound.ladder')}</h2>
      <ol className="ladder">
        {LAB_STAGES.map((s, i) => {
          const done = stageDone(p, sound, s);
          const total = ladder[s].length;
          const complete = done === total;
          return (
            <li key={s}>
              <button type="button" className={`rung ${complete ? 'rung--done' : s === nextStage ? 'rung--next' : ''}`} onClick={() => nav(`/lab/${encodeURIComponent(sound)}/${s}`)}>
                <span className="rung__n">{complete ? <Icon name="check" size={20} /> : i + 1}</span>
                <span className="rung__text"><b>{stageLabel(s)}</b><small>{ladder[s].map((it) => shownText(it)).join(' · ')}</small></span>
                <span className="rung__count">{done}/{total}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="sticky-cta"><Button variant="coral" size="lg" icon="mic" block onClick={() => nav(`/lab/${encodeURIComponent(sound)}/${nextStage}`)}>{t(STAGE_LINES[nextStage].practise)}</Button></div>
    </div>
  );
}

export function LabStagePlayer() {
  const { t } = useT();
  const nav = useNavigate();
  const { sound = '', stage = 'syllables' } = useParams();
  const addXp = useStore((s) => s.addXp);
  const award = useStore((s) => s.award);
  const ladder = LADDERS[sound];
  const items = ladder?.[stage as LabStage];
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  if (!items) return <div className="screen screen--center"><p>{t('lab.stage.missing')}</p><Button onClick={() => nav('/lab')}>{t('lab.back.lab')}</Button></div>;
  const stageIdx = LAB_STAGES.indexOf(stage as LabStage);
  const next = LAB_STAGES[stageIdx + 1];
  const back = `/lab/${encodeURIComponent(sound)}`;

  if (finished) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const nextLine = next ? STAGE_LINES[next].next : undefined;
    return (
      <div className="screen complete">
        <div className="complete__stage">
          <Mascot mood="cheer" size={120} />
          <h1>{t(STAGE_LINES[stage as LabStage].done)}</h1>
          <div className="stat-row"><div className="stat"><b>{avg}</b><span>{t('lab.stage.average')}</span></div><div className="stat stat--sun"><b>+{XP.labStage}</b><span>{t('lab.stage.bonus')}</span></div></div>
          <p className="onboard__sub">{t(nextLine ?? 'lab.stage.climbed', { label: phonemeInfo(sound).label })}</p>
        </div>
        <div className="complete__dock">
          {next ? <Button variant="coral" size="lg" block onClick={() => { setIndex(0); setScores([]); setFinished(false); nav(`${back}/${next}`, { replace: true }); }}>{t('lab.stage.keepClimbing')}</Button> : null}
          <Button variant={next ? 'ghost' : 'leaf'} size={next ? 'md' : 'lg'} block onClick={() => nav(back)}>{t('lab.back.ladder')}</Button>
        </div>
      </div>
    );
  }

  const item = items[index];
  return (
    <div className="screen lesson">
      <header className="lesson__bar">
        <button type="button" className="icon-btn" aria-label={t('lab.back.ladder')} onClick={() => nav(back)}><Icon name="close" /></button>
        <ProgressBar value={index / items.length} tone="leaf" />
        <span className="lesson__count">{index + 1}/{items.length}</span>
      </header>
      <div className="lesson__body" key={item.id}>
        <SpeakExercise item={item} context="lab" onDone={(r) => {
          const all = [...scores, r.best];
          setScores(all);
          if (index + 1 < items.length) return setIndex(index + 1);
          addXp(XP.labStage);
          if (!next) { const a = award('lab-ladder'); if (a) toast(badgeName(a), a.icon); }
          setFinished(true);
        }} />
      </div>
    </div>
  );
}
