import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { contentBand, type Accent, type AgeBand, type CourseId, type Goal, type HomeLanguage, type Level } from '../../domain/types';
import { ASSESSMENT_ITEMS } from '../../content/course';
import { phonemeInfo } from '../../content/phonemes';
import { HOME_LANGUAGES, homeLanguageLabel } from '../../content/translations';
import { FR_CHECK_ITEMS } from '../../content/fr/course';
import { ZH_CHECK_ITEMS } from '../../content/zh/course';
import { LANGUAGES, language, type Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { labOrder, WEAK_BELOW } from '../../intelligence/profile';
import { micSupported } from '../../speech/recorder';
import { voice } from '../../speech/voice';
import { useProfile, useStore } from '../../state/store';
import { Button, IconButton, ProgressBar, toast } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { SpeakExercise } from '../speak/SpeakExercise';

const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🐯', '🐨', '🚀', '⚽', '🎸', '🎨'];
// The lists below hold KEYS, not wording: a constant is read once, and the App language can change (src/i18n/README.md).
const LEVELS: { id: Level; icon: string; title: Key; detail: Key }[] = [
  { id: 'new', icon: '🌱', title: 'onboarding.level.new.title', detail: 'onboarding.level.new.detail' },
  { id: 'some', icon: '🌿', title: 'onboarding.level.some.title', detail: 'onboarding.level.some.detail' },
  { id: 'confident', icon: '🌳', title: 'onboarding.level.confident.title', detail: 'onboarding.level.confident.detail' },
];
/** Travel and fun are anyone's; school and work are not, and neither is what you do with the language all day. */
const GOALS_CHILD: { id: Goal; icon: string; title: Key }[] = [
  { id: 'school', icon: '🎒', title: 'onboarding.level.goal.school' }, { id: 'travel', icon: '✈️', title: 'onboarding.level.goal.travel' },
  { id: 'friends', icon: '💬', title: 'onboarding.level.goal.friends' }, { id: 'fun', icon: '🎮', title: 'onboarding.level.goal.fun' },
];
const GOALS_ADULT: { id: Goal; icon: string; title: Key }[] = [
  { id: 'work', icon: '💼', title: 'onboarding.level.goal.work' }, { id: 'travel', icon: '✈️', title: 'onboarding.level.goal.travel' },
  { id: 'everyday', icon: '🛒', title: 'onboarding.level.goal.everyday' }, { id: 'fun', icon: '🎮', title: 'onboarding.level.goal.fun' },
];
const LEARN: { id: CourseId | 'es' | 'fr' | 'de'; label: Key; ready: boolean; lang?: string }[] = [
  { id: 'en', label: 'common.course.en', ready: true }, { id: 'zh', label: 'onboarding.languages.learn.zh', ready: true, lang: 'zh-Hant' },
  { id: 'es', label: 'onboarding.languages.learn.es', ready: false }, { id: 'fr', label: 'onboarding.languages.learn.fr', ready: true, lang: 'fr' }, { id: 'de', label: 'onboarding.languages.learn.de', ready: false },
];
/**
 * Who a sentence is about: the grown-up themself, the child by nickname, or "your child" before a nickname is typed.
 * Each is a whole sentence of its own, because the words around the name change with it (and differently in Chinese).
 */
type About = 'adult' | 'named' | 'unnamed';
const LEVEL_TITLE: Record<About, Key> = { adult: 'onboarding.level.title.adult', named: 'onboarding.level.title.named', unnamed: 'onboarding.level.title.unnamed' };
const MIC_BODY: Record<About, Key> = { adult: 'onboarding.consent.mic.body.adult', named: 'onboarding.consent.mic.body.named', unnamed: 'onboarding.consent.mic.body.unnamed' };
const RECORDINGS_BODY: Record<About, Key> = { adult: 'onboarding.consent.recordings.body.adult', named: 'onboarding.consent.recordings.body.named', unnamed: 'onboarding.consent.recordings.body.unnamed' };
/**
 * Setup asks for an age RANGE, not a birthday. The app only ever sorts a learner into one of these four — they set
 * the look, the vocabulary and how much reading there is — so asking for a number to the year collected a child's
 * personal detail we never use, and made a fourteen-button grid of a four-way choice.
 *
 * `age` is the first year of the range, which is what `bandForAge` turns back into the band; nothing treats it as a
 * real age. (The recordings export carries `band` beside it, which is what accuracy work actually reads.)
 */
const BANDS: { band: AgeBand; age: number; label: Key; hint: Key }[] = [
  { band: 'little', age: 5, label: 'onboarding.who.band.little.label', hint: 'onboarding.who.band.little' },
  { band: 'junior', age: 8, label: 'onboarding.who.band.junior.label', hint: 'onboarding.who.band.junior' },
  { band: 'teen', age: 12, label: 'onboarding.who.band.teen.label', hint: 'onboarding.who.band.teen' },
  { band: 'adult', age: 18, label: 'onboarding.who.band.adult.label', hint: 'onboarding.who.adultHint' },
];
const ADULT_AGE = 18;

type StepId = 'welcome' | 'languages' | 'learner' | 'level' | 'accent' | 'script' | 'consent' | 'handover' | 'check' | 'plan';

export function Onboarding() {
  const { t, tc } = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const adding = params.get('add') === '1';
  const existing = useProfile();
  const hadProfileOnMount = useRef(!!existing);
  const createProfile = useStore((s) => s.createProfile);
  const setSettings = useStore((s) => s.setSettings);
  const patchProfile = useStore((s) => s.patchProfile);
  const settings = useStore((s) => s.settings);

  const [step, setStep] = useState<StepId>(adding ? 'languages' : 'welcome');
  const [learning, setLearning] = useState<CourseId[]>(['en']);
  const [home, setHome] = useState<HomeLanguage | null>(existing?.homeLanguage ?? null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [age, setAge] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  // US English gives the most detailed pronunciation feedback (every sound named, "what came out instead"), so it
  // leads; British stays one tap away.
  const [accent, setAccent] = useState<Accent>('en-US');
  const [script, setScript] = useState<'hant' | 'hans'>('hant');
  const [keepRecordings, setKeepRecordings] = useState(settings.storeRecordings);
  const [agreed, setAgreed] = useState(false);
  const [checkIndex, setCheckIndex] = useState(0);

  if (hadProfileOnMount.current && !adding) return <Navigate to="/" replace />;

  // There is no "is this for you or for a child?" question: the age answers it. A grown-up setting the app up for
  // themselves is not a special case of a parent, and asking made the app look as though it were only for children.
  const adult = age === ADULT_AGE;
  const order: StepId[] = [
    ...(adding ? [] : ['welcome' as const]), 'languages', 'learner', 'level',
    ...(learning.includes('en') ? ['accent' as const] : []), ...(learning.includes('zh') ? ['script' as const] : []),
    'consent', ...(adult ? [] : ['handover' as const]), 'check', 'plan',
  ];
  const about: About = adult ? 'adult' : name.trim() ? 'named' : 'unnamed';
  // Crossing the line between a child and a grown-up changes which reasons for learning are offered, so a reason
  // chosen from the other list cannot stay selected behind the scenes.
  const pickAge = (years: number) => { if ((years === ADULT_AGE) !== adult) setGoal(null); setAge(years); };
  const go = (s: StepId) => setStep(s);
  const next = () => go(order[order.indexOf(step) + 1]);
  const back = () => {
    const i = order.indexOf(step);
    if (adding && i <= 0) return nav('/parents');
    if (i > 0) go(order[i - 1]);
  };
  const progress = Math.max(0, order.indexOf(step)) / (order.length - 1);
  const firstCourse: CourseId = learning[0] ?? 'en';

  const create = async () => {
    setSettings({ storeRecordings: keepRecordings, consentedAt: Date.now() });
    // Ask for the microphone now, with the grown-up present, so a child never meets a permission prompt alone.
    if (micSupported()) {
      try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((track) => track.stop()); }
      catch { toast(t('onboarding.consent.micBlocked'), '🎙️'); }
    }
    createProfile({
      name: name.trim() || t(adult ? 'onboarding.defaultName.adult' : 'onboarding.defaultName.child'), avatar, age: age!, homeLanguage: home ?? 'other',
      level: level!, goal: goal!, accent, learning, zhScript: script,
    });
    next();
  };

  const toggleCourse = (id: CourseId) => setLearning((l) => (l.includes(id) ? (l.length > 1 ? l.filter((x) => x !== id) : l) : [...l, id]));

  const shell = (body: React.ReactNode, footer: React.ReactNode, opts: { mascot?: 'idle' | 'happy' | 'cheer' | 'talking'; title?: string; sub?: string; grownUp?: boolean } = {}) => (
    <div className="screen onboard">
      {step !== 'welcome' && step !== 'plan' && (
        <header className="lesson__bar">
          {step !== 'handover' ? <IconButton icon="back" label={t('common.back')} onClick={back} /> : <span className="topbar__spacer" />}
          <ProgressBar value={progress} />
          <span className="topbar__spacer" />
        </header>
      )}
      <div className="onboard__body">
        {/* The App language comes before every other choice, so the family can read the rest of setup — on whichever
            screen is first. Adding a second learner starts at "languages", not at the welcome screen, and used to
            offer no way to change the language at all. */}
        {step === order[0] && (
          <div className="segmented segmented--lang" role="group" aria-label={t('onboarding.language.aria')}>
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" lang={l.htmlLang} className={language() === l.id ? 'is-on' : ''} aria-pressed={language() === l.id} onClick={() => setSettings({ language: l.id })}>{l.label}</button>
            ))}
          </div>
        )}
        {opts.grownUp && !adult && <span className="tag tag--primary">{t('onboarding.grownUps')}</span>}
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
          <li><span>🎤</span>{t('onboarding.welcome.promise.say')}</li><li><span>🎯</span>{t('onboarding.welcome.promise.see')}</li><li><span>📈</span>{t('onboarding.welcome.promise.hear')}</li>
        </ul>,
        <><Button size="lg" block onClick={next}>{t('onboarding.welcome.start')}</Button><p className="fineprint">{t('onboarding.welcome.fineprint')}</p></>,
        { mascot: 'happy', title: t('onboarding.welcome.title'), sub: t('onboarding.welcome.sub') },
      );

    case 'languages':
      return shell(
        <>
          <h2 className="field-label">{t('onboarding.languages.learning')}</h2>
          <div className="chips">{LEARN.map((l) => {
            const on = l.ready && learning.includes(l.id as CourseId);
            return (
              <button key={l.id} type="button" className={`chip ${on ? 'is-on' : ''}`} disabled={!l.ready} aria-pressed={on} onClick={() => l.ready && toggleCourse(l.id as CourseId)}>
                <span lang={l.lang}>{t(l.label)}</span>{!l.ready && <small> · {t('onboarding.languages.soon')}</small>}
              </button>
            );
          })}</div>
          <p className="hint hint--left">{t('onboarding.languages.hint')}</p>
          <h2 className="field-label">{t('onboarding.languages.home')}</h2>
          <div className="grid-2">{HOME_LANGUAGES.map((l) => (
            <button key={l.id} type="button" className={`tile ${home === l.id ? 'is-on' : ''}`} onClick={() => setHome(l.id)} aria-pressed={home === l.id}>
              <span><b lang={l.id === 'other' ? undefined : l.id}>{l.native || homeLanguageLabel(l.id)}</b>{homeLanguageLabel(l.id) !== l.native && <small>{homeLanguageLabel(l.id)}</small>}</span>
            </button>
          ))}</div>
        </>,
        <Button size="lg" block disabled={!home || !learning.length} onClick={next}>{t('onboarding.next')}</Button>,
        { grownUp: true, title: t('onboarding.languages.title'), sub: t('onboarding.languages.sub') },
      );

    case 'learner':
      return shell(
        <>
          {/* Age comes first because it answers everything else: the look, the wording, and whether the rest of
              setup is a parent's or the learner's own. 18+ is simply the last of the four. */}
          <h2 className="field-label">{t('onboarding.who.age')}</h2>
          <div className="stack">{BANDS.map((b) => (
            <button key={b.band} type="button" className={`tile tile--wide ${age === b.age ? 'is-on' : ''}`} onClick={() => pickAge(b.age)} aria-pressed={age === b.age}>
              <span><b>{t(b.label)}</b><small>{t(b.hint)}</small></span>
            </button>
          ))}</div>
          <h2 className="field-label">{t('onboarding.who.buddy')}</h2>
          <div className="avatars">{AVATARS.map((a) => <button key={a} type="button" className={`avatar-pick ${avatar === a ? 'is-on' : ''}`} onClick={() => setAvatar(a)} aria-pressed={avatar === a} aria-label={t('onboarding.who.avatar.aria', { avatar: a })}>{a}</button>)}</div>
          <label className="field-label" htmlFor="nick">{t(adult ? 'onboarding.who.name.adult.label' : 'onboarding.who.name.child.label')} <small>{t(adult ? 'onboarding.who.name.adult.note' : 'onboarding.who.name.child.note')}</small></label>
          <input id="nick" className="input" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder={t(adult ? 'onboarding.who.name.adult.placeholder' : 'onboarding.who.name.child.placeholder')} autoComplete="off" />
        </>,
        <Button size="lg" block disabled={age === null} onClick={next}>{t('onboarding.next')}</Button>,
        { grownUp: true, title: t('onboarding.who.title'), sub: t('onboarding.who.sub') },
      );

    case 'level':
      return shell(
        <>
          <h2 className="field-label">{t('onboarding.level.label')}</h2>
          <div className="stack">{LEVELS.map((l) => (
            <button key={l.id} type="button" className={`tile tile--wide ${level === l.id ? 'is-on' : ''}`} onClick={() => setLevel(l.id)} aria-pressed={level === l.id}>
              <span className="tile__icon">{l.icon}</span><span><b>{t(l.title)}</b><small>{t(l.detail)}</small></span>
            </button>
          ))}</div>
          <h2 className="field-label">{t('onboarding.level.goal.label')}</h2>
          <div className="chips">{(adult ? GOALS_ADULT : GOALS_CHILD).map((g) => <button key={g.id} type="button" className={`chip ${goal === g.id ? 'is-on' : ''}`} onClick={() => setGoal(g.id)} aria-pressed={goal === g.id}>{g.icon} {t(g.title)}</button>)}</div>
        </>,
        <Button size="lg" block disabled={!level || !goal} onClick={next}>{t('onboarding.next')}</Button>,
        { grownUp: true, title: t(LEVEL_TITLE[about], { name: name.trim() }) },
      );

    case 'accent':
      return shell(
        <div className="stack">
          {([['en-US', 'onboarding.accent.us.badge', 'onboarding.accent.us.title', 'onboarding.accent.us.detail'], ['en-GB', 'onboarding.accent.uk.badge', 'onboarding.accent.uk.title', 'onboarding.accent.uk.detail']] as const).map(([id, flag, title, detail]) => (
            <button key={id} type="button" className={`tile tile--wide ${accent === id ? 'is-on' : ''}`} aria-pressed={accent === id}
              onClick={() => { setAccent(id); void voice.speak('Hello! I would like some water, please.', { accent: id }).catch(() => undefined); }}>
              <span className="code-badge">{t(flag)}</span><span><b>{t(title)}</b><small>{t(detail)}</small></span><span className="tile__aside" aria-hidden>🔈</span>
            </button>
          ))}
          <p className="hint">{t('onboarding.accent.hint')}</p>
        </div>,
        <Button size="lg" block onClick={next}>{t('onboarding.next')}</Button>,
        { grownUp: true, title: t('onboarding.accent.title'), sub: t('onboarding.accent.sub') },
      );

    case 'script':
      return shell(
        <div className="stack">
          {([['hant', '繁', 'onboarding.script.hant.title', 'onboarding.script.hant.detail'], ['hans', '简', 'onboarding.script.hans.title', 'onboarding.script.hans.detail']] as const).map(([id, badge, title, detail]) => (
            <button key={id} type="button" className={`tile tile--wide ${script === id ? 'is-on' : ''}`} aria-pressed={script === id} onClick={() => setScript(id)}>
              <span className="code-badge" lang={id === 'hant' ? 'zh-Hant' : 'zh-Hans'}>{badge}</span><span><b lang={id === 'hant' ? 'zh-Hant' : 'zh-Hans'}>{t(title)}</b><small>{t(detail)}</small></span>
            </button>
          ))}
          <p className="hint">{t('onboarding.script.hint')}</p>
        </div>,
        <Button size="lg" block onClick={next}>{t('onboarding.next')}</Button>,
        { grownUp: true, title: t('onboarding.script.title'), sub: t('onboarding.script.sub') },
      );

    case 'consent':
      return shell(
        <>
          <ul className="privacy">
            <li><span>🎙️</span><div><b>{t('onboarding.consent.mic.title')}</b><p>{t(MIC_BODY[about], { name: name.trim() })}</p></div></li>
            <li><span>📱</span><div><b>{t('onboarding.consent.recordings.title')}</b><p>{t(RECORDINGS_BODY[about], { name: name.trim() })}</p></div></li>
            <li><span>🗑️</span><div><b>{t('onboarding.consent.control.title')}</b><p>{adult ? t('onboarding.consent.control.body.adult', { settings: t('common.settings.adult'), tab: t('common.nav.me') }) : t('onboarding.consent.control.body.child', { settings: t('common.settings.parent.the') })}</p></div></li>
          </ul>
          <label className="switch-row"><input type="checkbox" checked={keepRecordings} onChange={(e) => setKeepRecordings(e.target.checked)} /><span className="switch" aria-hidden /><span>{t('onboarding.consent.keep')}</span></label>
          <label className="switch-row"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span className="switch" aria-hidden /><span>{t(adult ? 'onboarding.consent.agree.adult' : 'onboarding.consent.agree.child')}</span></label>
        </>,
        <Button size="lg" block disabled={!agreed} icon="mic" onClick={() => void create()}>{t('onboarding.consent.allow')}</Button>,
        { grownUp: true, title: t('onboarding.consent.title'), sub: t(adult ? 'onboarding.consent.sub.adult' : 'onboarding.consent.sub.child') },
      );

    case 'handover':
      return shell(
        <div className="handover"><div className="handover__avatar">{avatar}</div></div>,
        <Button size="lg" variant="coral" block onClick={next}>{name.trim() ? t('onboarding.handover.go.named', { name: name.trim() }) : t('onboarding.handover.go.unnamed')}</Button>,
        { mascot: 'cheer', title: name.trim() ? t('onboarding.handover.title.named', { name: name.trim() }) : t('onboarding.handover.title.unnamed'), sub: t('onboarding.handover.sub') },
      );

    case 'check': {
      const profile = useStore.getState().profiles[useStore.getState().activeId ?? ''];
      const band = contentBand(profile?.band ?? 'junior');
      const items = (firstCourse === 'zh' ? ZH_CHECK_ITEMS : firstCourse === 'fr' ? FR_CHECK_ITEMS : ASSESSMENT_ITEMS)[band];
      const item = items[checkIndex];
      return (
        <div className="screen lesson">
          <header className="lesson__bar"><span className="topbar__spacer" /><ProgressBar value={checkIndex / items.length} tone="leaf" /><span className="lesson__count">{checkIndex + 1}/{items.length}</span></header>
          <div className="lesson__body" key={item.id}>
            <SpeakExercise item={item} context="onboarding" mode="check" onDone={() => {
              if (checkIndex + 1 < items.length) return setCheckIndex(checkIndex + 1);
              if (firstCourse === 'zh' && profile) patchProfile(profile.id, { zhChecked: true });
              go('plan');
            }} />
          </div>
        </div>
      );
    }

    case 'plan': {
      const profile = useStore.getState().profiles[useStore.getState().activeId ?? ''];
      if (!profile) return <Navigate to="/" replace />;
      const zh = firstCourse === 'zh';
      // One low take is enough evidence for a starting plan; home-language predictions fill any gaps.
      const heardLow = Object.values(profile.pronunciation.phonemes)
        .filter((s) => s.phoneme.startsWith('zh:') === zh && s.ema < WEAK_BELOW && phonemeInfo(s.phoneme).difficulty >= 0.3)
        .sort((a, b) => a.ema - b.ema).map((s) => s.phoneme);
      const focus = [...new Set([...heardLow, ...labOrder(profile.pronunciation, profile.homeLanguage, firstCourse)])].slice(0, 3);
      const strong = Object.values(profile.pronunciation.phonemes)
        .filter((s) => s.phoneme.startsWith('zh:') === zh && s.ema >= 88 && phonemeInfo(s.phoneme).difficulty >= 0.35 && !focus.includes(s.phoneme)).slice(0, 3);
      return shell(
        <>
          <div className="card plan">
            <h2>{t(zh ? 'onboarding.plan.focus.zh' : 'onboarding.plan.focus.en')}</h2>
            <div className="plan__sounds">{focus.map((ph) => <span key={ph} className="sound-badge sound-badge--weak"><b>{phonemeInfo(ph).label}</b><small>{zh ? tc(`sound.${ph}.name`, phonemeInfo(ph).name) : phonemeInfo(ph).example}</small></span>)}</div>
            {strong.length > 0 && (<><h2>{t('onboarding.plan.strong')}</h2><div className="plan__sounds">{strong.map((s) => <span key={s.phoneme} className="sound-badge sound-badge--good"><b>{phonemeInfo(s.phoneme).label}</b><small>{zh ? tc(`sound.${s.phoneme}.name`, phonemeInfo(s.phoneme).name) : phonemeInfo(s.phoneme).example}</small></span>)}</div></>)}
          </div>
          <p className="hint">{t(adult ? 'onboarding.plan.hint.adult' : 'onboarding.plan.hint.child')}</p>
        </>,
        <Button size="lg" block onClick={() => nav('/', { replace: true })}>{t('onboarding.plan.start')}</Button>,
        { mascot: 'happy', title: adult ? t('onboarding.plan.title.adult') : t('onboarding.plan.title.child', { name: profile.name }), sub: t(adult ? 'onboarding.plan.sub.adult' : 'onboarding.plan.sub.child') },
      );
    }
  }
}
