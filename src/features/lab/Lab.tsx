import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isGrownUp, type ChildProfile, type PhonemeId } from '../../domain/types';
import { LADDERS, LAB_STAGES, STAGE_LABEL, type LabStage } from '../../content/lab';
import { exampleSpeech, isLongLabel, phonemeInfo, tipFor } from '../../content/phonemes';
import { shownText } from '../../content/zh/script';
import { XP } from '../../engine/rewards';
import { labOrder, MASTERED_AT, WEAK_BELOW } from '../../intelligence/profile';
import { voice } from '../../speech/voice';
import { ToneContour } from '../../ui/ToneContour';
import { useActiveProfile, useStore } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, ProgressBar, toast, TopBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { Mouth } from '../../ui/Mouth';
import { SpeakExercise } from '../speak/SpeakExercise';

const status = (p: ChildProfile, id: PhonemeId) => {
  const s = p.pronunciation.phonemes[id];
  if (!s || s.count < 2) return { key: 'new', label: 'Not checked yet', score: null as number | null };
  const score = Math.round(s.ema);
  if (s.masteredAt) return { key: 'good', label: 'Mastered', score };
  if (s.ema >= MASTERED_AT) return { key: 'good', label: 'Sounding great', score };
  if (s.ema < WEAK_BELOW) return { key: 'weak', label: 'Needs practice', score };
  return { key: 'okay', label: 'Getting better', score };
};

const stageDone = (p: ChildProfile, sound: PhonemeId, stage: LabStage) => LADDERS[sound][stage].filter((it) => p.items[it.id]?.mastered).length;

export function LabHome() {
  const nav = useNavigate();
  const p = useActiveProfile();
  const order = labOrder(p.pronunciation, p.homeLanguage, p.course);
  return (
    <div className="screen lab">
      <TopBar title="Pronunciation Lab" />
      <p className="lead">{p.course === 'zh' ? 'Your trickiest tones and sounds come first. Climb each ladder: syllables → words → phrases → sentence.' : 'Your trickiest sounds come first. Climb each ladder: sound → syllables → words → phrases → sentence.'}</p>
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
                  <small>as in “{info.example}”{isGrownUp(p.band) && !id.startsWith('zh:') ? ` · /${id}/` : ''}</small>
                  <ProgressBar value={done / total} tone="leaf" />
                </span>
                <span className="sound-card__side">
                  {st.score != null ? <b className={`score-text score-text--${st.key}`}>{st.score}</b> : <Icon name="chevron" size={20} />}
                  <small>{i === 0 && st.key !== 'good' ? 'Start here' : st.label}</small>
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
  const nav = useNavigate();
  const { sound = '' } = useParams();
  const p = useActiveProfile();
  const ladder = LADDERS[sound];
  const info = phonemeInfo(sound);
  if (!ladder) return <div className="screen screen--center"><p>That sound isn’t in the Lab yet.</p><Button onClick={() => nav('/lab')}>Back to the Lab</Button></div>;

  const st = status(p, sound);
  const nextStage = LAB_STAGES.find((s) => stageDone(p, sound, s) < ladder[s].length) ?? 'sentence';
  const zh = sound.startsWith('zh:');
  const say = (slow: boolean) => void voice.speak(exampleSpeech(sound), { accent: zh ? 'zh-CN' : p.accent, slow }).catch(() => toast('Sound isn’t working on this device right now', '🔇'));

  return (
    <div className="screen lab-sound">
      <TopBar title={info.name} onBack={() => nav('/lab')} />
      <section className="card guide">
        <div className="guide__top">
          <div className="guide__glyph" data-long={isLongLabel(info.label) || undefined}><b>{info.label}</b>{p.band !== 'little' && !zh && <small>/{sound}/</small>}</div>
          {info.category === 'tone' ? <ToneContour tone={Number(sound.slice(-1)) as 1 | 2 | 3 | 4} size={190} /> : <Mouth pose={info.pose} size={190} />}
        </div>
        <p className="guide__tip">{tipFor(sound, p.band)}</p>
        <ul className="steps">
          {info.steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
          {info.category !== 'tone' && <li className={info.pose.voiced ? 'steps__voice on' : 'steps__voice'}><span>{info.pose.voiced ? '〰' : '·'}</span>{info.pose.voiced ? 'Voice ON — feel your throat buzz' : 'Voice OFF — just air'}</li>}
        </ul>
        <div className="listen-row">
          <button type="button" className="pill" onClick={() => say(false)}><Icon name="speaker" size={20} />“{info.example}”</button>
          <button type="button" className="pill" onClick={() => say(true)}><Icon name="turtle" size={20} />Slow</button>
        </div>
        {st.score != null && <p className="guide__score">Your “{info.label}” right now: <b className={`score-text score-text--${st.key}`}>{st.score}</b> · {st.label}</p>}
      </section>

      <h2 className="section-title">The ladder</h2>
      <ol className="ladder">
        {LAB_STAGES.map((s, i) => {
          const done = stageDone(p, sound, s);
          const total = ladder[s].length;
          const complete = done === total;
          return (
            <li key={s}>
              <button type="button" className={`rung ${complete ? 'rung--done' : s === nextStage ? 'rung--next' : ''}`} onClick={() => nav(`/lab/${encodeURIComponent(sound)}/${s}`)}>
                <span className="rung__n">{complete ? <Icon name="check" size={20} /> : i + 1}</span>
                <span className="rung__text"><b>{STAGE_LABEL[s]}</b><small>{ladder[s].map((it) => shownText(it)).join(' · ')}</small></span>
                <span className="rung__count">{done}/{total}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="sticky-cta"><Button variant="coral" size="lg" icon="mic" block onClick={() => nav(`/lab/${encodeURIComponent(sound)}/${nextStage}`)}>Practise {STAGE_LABEL[nextStage].toLowerCase()}</Button></div>
    </div>
  );
}

export function LabStagePlayer() {
  const nav = useNavigate();
  const { sound = '', stage = 'syllables' } = useParams();
  const addXp = useStore((s) => s.addXp);
  const award = useStore((s) => s.award);
  const ladder = LADDERS[sound];
  const items = ladder?.[stage as LabStage];
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  if (!items) return <div className="screen screen--center"><p>That practice isn’t available.</p><Button onClick={() => nav('/lab')}>Back to the Lab</Button></div>;
  const stageIdx = LAB_STAGES.indexOf(stage as LabStage);
  const next = LAB_STAGES[stageIdx + 1];
  const back = `/lab/${encodeURIComponent(sound)}`;

  if (finished) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return (
      <div className="screen complete">
        <div className="complete__stage">
          <Mascot mood="cheer" size={120} />
          <h1>{STAGE_LABEL[stage as LabStage]} done!</h1>
          <div className="stat-row"><div className="stat"><b>{avg}</b><span>Average</span></div><div className="stat stat--sun"><b>+{XP.labStage}</b><span>Bonus XP</span></div></div>
          <p className="onboard__sub">{next ? `Next rung: ${STAGE_LABEL[next].toLowerCase()} with the “${phonemeInfo(sound).label}” sound.` : `You climbed the whole “${phonemeInfo(sound).label}” ladder!`}</p>
        </div>
        <div className="complete__dock">
          {next ? <Button variant="coral" size="lg" block onClick={() => { setIndex(0); setScores([]); setFinished(false); nav(`${back}/${next}`, { replace: true }); }}>Keep climbing</Button> : null}
          <Button variant={next ? 'ghost' : 'leaf'} size={next ? 'md' : 'lg'} block onClick={() => nav(back)}>Back to the ladder</Button>
        </div>
      </div>
    );
  }

  const item = items[index];
  return (
    <div className="screen lesson">
      <header className="lesson__bar">
        <button type="button" className="icon-btn" aria-label="Back to the ladder" onClick={() => nav(back)}><Icon name="close" /></button>
        <ProgressBar value={index / items.length} tone="leaf" />
        <span className="lesson__count">{index + 1}/{items.length}</span>
      </header>
      <div className="lesson__body" key={item.id}>
        <SpeakExercise item={item} context="lab" onDone={(r) => {
          const all = [...scores, r.best];
          setScores(all);
          if (index + 1 < items.length) return setIndex(index + 1);
          addXp(XP.labStage);
          if (!next) { const a = award('lab-ladder'); if (a) toast(a.title, a.icon); }
          setFinished(true);
        }} />
      </div>
    </div>
  );
}
