import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { Accent, Goal, HomeLanguage, Level } from '../../domain/types';
import { ASSESSMENT_ITEMS } from '../../content/course';
import { phonemeInfo } from '../../content/phonemes';
import { HOME_LANGUAGES } from '../../content/translations';
import { labOrder, WEAK_BELOW } from '../../intelligence/profile';
import { micSupported } from '../../speech/recorder';
import { voice } from '../../speech/voice';
import { bandForAge, useProfile, useStore } from '../../state/store';
import { Button, IconButton, ProgressBar, toast } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { SpeakExercise } from '../speak/SpeakExercise';

const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🐯', '🐨', '🚀', '⚽', '🎸', '🎨'];
const LEVELS: { id: Level; icon: string; title: string; detail: string }[] = [
  { id: 'new', icon: '🌱', title: 'Just starting', detail: 'Knows a few words or none yet' },
  { id: 'some', icon: '🌿', title: 'Knows some English', detail: 'Simple words and short sentences' },
  { id: 'confident', icon: '🌳', title: 'Quite confident', detail: 'Wants to sound clearer and more natural' },
];
const GOALS: { id: Goal; icon: string; title: string }[] = [
  { id: 'school', icon: '🎒', title: 'School' }, { id: 'travel', icon: '✈️', title: 'Travel' },
  { id: 'friends', icon: '💬', title: 'Friends & family' }, { id: 'fun', icon: '🎮', title: 'Just for fun' },
];
const LEARN = [{ id: 'en', label: 'English', ready: true }, { id: 'es', label: 'Spanish', ready: false }, { id: 'fr', label: 'French', ready: false }, { id: 'de', label: 'German', ready: false }];

type StepId = 'welcome' | 'languages' | 'child' | 'level' | 'accent' | 'consent' | 'handover' | 'check' | 'plan';
const ORDER: StepId[] = ['welcome', 'languages', 'child', 'level', 'accent', 'consent', 'handover', 'check', 'plan'];

export function Onboarding() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const adding = params.get('add') === '1';
  const existing = useProfile();
  const hadProfileOnMount = useRef(!!existing);
  const createProfile = useStore((s) => s.createProfile);
  const setSettings = useStore((s) => s.setSettings);
  const settings = useStore((s) => s.settings);

  const [step, setStep] = useState<StepId>(adding ? 'child' : 'welcome');
  const [home, setHome] = useState<HomeLanguage | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [age, setAge] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [accent, setAccent] = useState<Accent>('en-US');
  const [keepRecordings, setKeepRecordings] = useState(settings.storeRecordings);
  const [agreed, setAgreed] = useState(false);
  const [checkIndex, setCheckIndex] = useState(0);
  const [inheritedHome] = useState<HomeLanguage | null>(existing?.homeLanguage ?? null);

  if (hadProfileOnMount.current && !adding) return <Navigate to="/" replace />;

  const kid = name.trim() || 'your child';
  const go = (s: StepId) => setStep(s);
  const back = () => {
    const i = ORDER.indexOf(step);
    if (adding && step === 'child') return nav('/parents');
    if (i > 0) go(ORDER[i - 1]);
  };
  const progress = ORDER.indexOf(step) / (ORDER.length - 1);

  const create = async () => {
    setSettings({ storeRecordings: keepRecordings, consentedAt: Date.now() });
    // Ask for the microphone now, with the grown-up present, so the child never meets a permission prompt alone.
    if (micSupported()) {
      try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); }
      catch { toast('Microphone not allowed yet — you can fix this in a moment', '🎙️'); }
    }
    createProfile({ name: name.trim() || 'Explorer', avatar, age: age!, homeLanguage: (home ?? inheritedHome ?? 'other'), level: level!, goal: goal!, accent });
    go('handover');
  };

  const shell = (body: React.ReactNode, footer: React.ReactNode, opts: { mascot?: 'idle' | 'happy' | 'cheer' | 'talking'; title?: string; sub?: string; grownUp?: boolean } = {}) => (
    <div className="screen onboard">
      {step !== 'welcome' && step !== 'plan' && (
        <header className="lesson__bar">
          {step !== 'handover' ? <IconButton icon="back" label="Back" onClick={back} /> : <span className="topbar__spacer" />}
          <ProgressBar value={progress} />
          <span className="topbar__spacer" />
        </header>
      )}
      <div className="onboard__body">
        {opts.grownUp && <span className="tag tag--primary">For grown-ups</span>}
        {opts.mascot && <Mascot mood={opts.mascot} size={step === 'welcome' ? 168 : 96} />}
        {opts.title && <h1 className="onboard__title">{opts.title}</h1>}
        {opts.sub && <p className="onboard__sub">{opts.sub}</p>}
        {body}
      </div>
      <div className="onboard__dock">{footer}</div>
    </div>
  );

  switch (step) {
    case 'welcome':
      return shell(
        <ul className="promise">
          <li><span>🎤</span>Say it out loud</li><li><span>🎯</span>See exactly which sound to fix</li><li><span>📈</span>Hear yourself get better</li>
        </ul>,
        <><Button size="lg" block onClick={() => go('languages')}>Get started</Button><p className="fineprint">Grown-ups: setup takes about a minute.</p></>,
        { mascot: 'happy', title: 'Wunder Tutor', sub: 'Speak English with confidence — one sound at a time.' },
      );

    case 'languages':
      return shell(
        <>
          <h2 className="field-label">We want to learn</h2>
          <div className="chips">{LEARN.map((l) => (
            <button key={l.id} type="button" className={`chip ${l.id === 'en' ? 'is-on' : ''}`} disabled={!l.ready} aria-pressed={l.id === 'en'}>{l.label}{!l.ready && <small> · soon</small>}</button>
          ))}</div>
          <h2 className="field-label">At home we speak</h2>
          <div className="grid-2">{HOME_LANGUAGES.map((l) => (
            <button key={l.id} type="button" className={`tile ${home === l.id ? 'is-on' : ''}`} onClick={() => setHome(l.id)} aria-pressed={home === l.id}>
              <span><b lang={l.id === 'other' ? undefined : l.id}>{l.native || l.label}</b><small>{l.label}</small></span>
            </button>
          ))}</div>
        </>,
        <Button size="lg" block disabled={!home} onClick={() => go('child')}>Next</Button>,
        { grownUp: true, title: 'Which languages?', sub: 'Your home language tells Pip which English sounds will be trickiest.' },
      );

    case 'child':
      return shell(
        <>
          <h2 className="field-label">Pick a buddy</h2>
          <div className="avatars">{AVATARS.map((a) => <button key={a} type="button" className={`avatar-pick ${avatar === a ? 'is-on' : ''}`} onClick={() => setAvatar(a)} aria-pressed={avatar === a} aria-label={`Avatar ${a}`}>{a}</button>)}</div>
          <label className="field-label" htmlFor="nick">Nickname <small>(no real names needed)</small></label>
          <input id="nick" className="input" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tiger" autoComplete="off" />
          <h2 className="field-label">Age</h2>
          <div className="ages">{Array.from({ length: 11 }, (_, i) => i + 5).map((n) => <button key={n} type="button" className={`age ${age === n ? 'is-on' : ''}`} onClick={() => setAge(n)} aria-pressed={age === n}>{n}</button>)}</div>
          {age && <p className="hint">{{ little: 'Picture-led lessons with single words and tiny phrases.', junior: 'Playful lessons with short sentences.', teen: 'A cleaner look with full, natural sentences.' }[bandForAge(age)]}</p>}
        </>,
        <Button size="lg" block disabled={!age} onClick={() => go('level')}>Next</Button>,
        { grownUp: true, title: 'Who’s learning?', sub: 'Age sets the look, the words and how much reading there is.' },
      );

    case 'level':
      return shell(
        <>
          <h2 className="field-label">English level</h2>
          <div className="stack">{LEVELS.map((l) => (
            <button key={l.id} type="button" className={`tile tile--wide ${level === l.id ? 'is-on' : ''}`} onClick={() => setLevel(l.id)} aria-pressed={level === l.id}>
              <span className="tile__icon">{l.icon}</span><span><b>{l.title}</b><small>{l.detail}</small></span>
            </button>
          ))}</div>
          <h2 className="field-label">Learning for</h2>
          <div className="chips">{GOALS.map((g) => <button key={g.id} type="button" className={`chip ${goal === g.id ? 'is-on' : ''}`} onClick={() => setGoal(g.id)} aria-pressed={goal === g.id}>{g.icon} {g.title}</button>)}</div>
        </>,
        <Button size="lg" block disabled={!level || !goal} onClick={() => go('accent')}>Next</Button>,
        { grownUp: true, title: `About ${kid}` },
      );

    case 'accent':
      return shell(
        <div className="stack">
          {([['en-US', 'US', 'American English', 'water sounds like “wah-der”'], ['en-GB', 'UK', 'British English', 'water sounds like “waw-tuh”']] as const).map(([id, flag, title, detail]) => (
            <button key={id} type="button" className={`tile tile--wide ${accent === id ? 'is-on' : ''}`} aria-pressed={accent === id}
              onClick={() => { setAccent(id); void voice.speak('Hello! I would like some water, please.', { accent: id }).catch(() => undefined); }}>
              <span className="code-badge">{flag}</span><span><b>{title}</b><small>{detail}</small></span><span className="tile__aside" aria-hidden>🔈</span>
            </button>
          ))}
          <p className="hint">Both are correct English. Pip uses your choice for the teacher’s voice and won’t mark the other accent’s sounds as mistakes.</p>
        </div>,
        <Button size="lg" block onClick={() => go('consent')}>Next</Button>,
        { grownUp: true, title: 'Which accent should Pip teach?', sub: 'Tap one to hear it.' },
      );

    case 'consent':
      return shell(
        <>
          <ul className="privacy">
            <li><span>🎙️</span><div><b>The microphone is only on while the mic button is red.</b><p>{kid} taps to start and it stops by itself.</p></div></li>
            <li><span>📱</span><div><b>Recordings stay on this device.</b><p>They let {kid} hear “before” and “now”. Scores are stored separately from voice.</p></div></li>
            <li><span>🗑️</span><div><b>You’re in control.</b><p>Delete recordings, history or the whole profile any time in the Parent Zone.</p></div></li>
          </ul>
          <label className="switch-row"><input type="checkbox" checked={keepRecordings} onChange={(e) => setKeepRecordings(e.target.checked)} /><span className="switch" aria-hidden /><span>Keep recordings on this device</span></label>
          <label className="switch-row"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span className="switch" aria-hidden /><span>I’m the parent or guardian and I agree to microphone use</span></label>
        </>,
        <Button size="lg" block disabled={!agreed} icon="mic" onClick={() => void create()}>Allow microphone</Button>,
        { grownUp: true, title: 'Voice & privacy', sub: 'A child’s voice is sensitive. Here’s exactly what happens to it.' },
      );

    case 'handover':
      return shell(
        <div className="handover"><div className="handover__avatar">{avatar}</div></div>,
        <Button size="lg" variant="coral" block onClick={() => go('check')}>I’m {name.trim() || 'ready'}!</Button>,
        { mascot: 'cheer', title: `Now it’s ${name.trim() ? `${name.trim()}’s` : 'your'} turn!`, sub: 'Pass the device over. Pip will listen to a few words to see which sounds need help — there are no wrong answers.' },
      );

    case 'check': {
      const profile = useStore.getState().profiles[useStore.getState().activeId ?? ''];
      const items = ASSESSMENT_ITEMS[profile?.band ?? 'junior'];
      const item = items[checkIndex];
      return (
        <div className="screen lesson">
          <header className="lesson__bar"><span className="topbar__spacer" /><ProgressBar value={checkIndex / items.length} tone="leaf" /><span className="lesson__count">{checkIndex + 1}/{items.length}</span></header>
          <div className="lesson__body" key={item.id}>
            <SpeakExercise item={item} context="onboarding" mode="check" onDone={() => (checkIndex + 1 < items.length ? setCheckIndex(checkIndex + 1) : go('plan'))} />
          </div>
        </div>
      );
    }

    case 'plan': {
      const profile = useStore.getState().profiles[useStore.getState().activeId ?? ''];
      if (!profile) return <Navigate to="/" replace />;
      // One low take is enough evidence for a starting plan; home-language predictions fill any gaps.
      const heardLow = Object.values(profile.pronunciation.phonemes).filter((s) => s.ema < WEAK_BELOW && phonemeInfo(s.phoneme).difficulty >= 0.3).sort((a, b) => a.ema - b.ema).map((s) => s.phoneme);
      const focus = [...new Set([...heardLow, ...labOrder(profile.pronunciation, profile.homeLanguage)])].slice(0, 3);
      const strong = Object.values(profile.pronunciation.phonemes).filter((s) => s.ema >= 88 && phonemeInfo(s.phoneme).difficulty >= 0.35 && !focus.includes(s.phoneme)).slice(0, 3);
      return shell(
        <>
          <div className="card plan">
            <h2>Sounds to work on</h2>
            <div className="plan__sounds">{focus.map((ph) => <span key={ph} className="sound-badge sound-badge--weak"><b>{phonemeInfo(ph).label}</b><small>{phonemeInfo(ph).example}</small></span>)}</div>
            {strong.length > 0 && (<><h2>Already strong</h2><div className="plan__sounds">{strong.map((s) => <span key={s.phoneme} className="sound-badge sound-badge--good"><b>{phonemeInfo(s.phoneme).label}</b><small>{phonemeInfo(s.phoneme).example}</small></span>)}</div></>)}
          </div>
          <p className="hint">Pip will sneak these sounds into lessons and remember how they go — they’ll keep coming back until they’re easy.</p>
        </>,
        <Button size="lg" block onClick={() => nav('/', { replace: true })}>Start learning</Button>,
        { mascot: 'happy', title: `Pip’s plan for ${profile.name}`, sub: 'Based on what Pip just heard.' },
      );
    }
  }
}
