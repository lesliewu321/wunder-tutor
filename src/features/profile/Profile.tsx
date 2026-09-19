import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsName, type Accent, type AgeBand, type CourseId, type ParentSettings } from '../../domain/types';
import { audioRepo } from '../../data/repository';
import { HOME_LANGUAGES } from '../../content/translations';
import { inScript } from '../../content/zh/script';
import { DAILY_GOALS, liveStreak } from '../../engine/rewards';
import { apiHealth, getAccessCode, setAccessCode, type ApiHealth } from '../../speech';
import { bandForAge, useActiveProfile, useStore } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, Sheet, toast, TopBar } from '../../ui/kit';

/** Written in Simplified; shown in the learner's script. */
const COURSE_NAME: Record<CourseId, string> = { en: 'English', zh: '普通话' };
const BAND_LABEL = { little: 'Little explorer · 5–7', junior: 'Junior · 8–11', teen: 'Teen · 12–15', adult: 'Grown-up learner' } as const;

export function Me() {
  const nav = useNavigate();
  const p = useActiveProfile();
  const profiles = useStore((s) => s.profiles);
  const setActive = useStore((s) => s.setActive);
  const patch = useStore((s) => s.patchProfile);
  const others = Object.values(profiles).filter((x) => x.id !== p.id);
  const level = Math.floor(p.xp / 100) + 1;

  return (
    <div className="screen me">
      <TopBar title="Me" />
      <section className="me__card">
        <div className="me__avatar">{p.avatar}</div>
        <h2>{p.name}</h2>
        <p>{BAND_LABEL[p.band]} · {p.learning.map((c) => (c === 'en' ? `${p.accent === 'en-US' ? 'American' : 'British'} English` : 'Putonghua')).join(' + ')}</p>
        <div className="stat-row">
          <div className="stat"><b>{level}</b><span>Level</span></div>
          <div className="stat stat--sun"><b>{p.xp}</b><span>Total XP</span></div>
          <div className="stat stat--coral"><b>{liveStreak(p.streak)}</b><span>Day streak</span></div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Daily goal</h2>
        <div className="goal-picker">
          {DAILY_GOALS.map((g) => (
            <button key={g.xp} type="button" className={`tile ${p.dailyGoalXp === g.xp ? 'is-on' : ''}`} aria-pressed={p.dailyGoalXp === g.xp} onClick={() => patch(p.id, { dailyGoalXp: g.xp })}>
              <span><b>{g.label}</b><small>{g.xp} XP · {g.detail}</small></span>
            </button>
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="section-title">Switch learner</h2>
          <div className="switcher">{others.map((o) => <button key={o.id} type="button" className="switcher__item" onClick={() => { setActive(o.id); toast(`Hi, ${o.name}!`, o.avatar); nav('/'); }}><span>{o.avatar}</span>{o.name}</button>)}</div>
        </section>
      )}

      <button type="button" className="row-link" onClick={() => nav('/parents')}>
        <span className="row-link__icon"><Icon name="shield" /></span>
        <span><b>{settingsName(p.band)}</b><small>Privacy, recordings, learners and settings</small></span>
        <Icon name="lock" size={20} />
      </button>
    </div>
  );
}

function Gate({ onPass, onCancel, band }: { onPass: () => void; onCancel: () => void; band: AgeBand }) {
  const [a, b] = useMemo(() => [6 + Math.floor(Math.random() * 4), 6 + Math.floor(Math.random() * 4)], []);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const submit = () => (Number(value) === a * b ? onPass() : (setWrong(true), setValue('')));
  return (
    <div className="screen screen--center gate">
      <span className="gate__icon"><Icon name="shield" size={36} /></span>
      <h1>{band === 'adult' ? 'Quick check' : 'Grown-ups only'}</h1>
      <p>To open {band === 'adult' ? 'Settings & privacy' : 'the Parent Zone'}, answer this multiplication:</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {/* Spelled out: the × glyph in the display font is easy to misread as +. */}
        <label className="gate__q" htmlFor="gate">{a} <span className="gate__op">times</span> {b} = ?</label>
        <input id="gate" className={`input input--center ${wrong ? 'input--wrong' : ''}`} inputMode="numeric" pattern="[0-9]*" autoFocus value={value} onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setWrong(false); }} aria-describedby="gate-msg" />
        <p id="gate-msg" className="gate__msg" role="status">{wrong ? `Not quite — multiply: ${a} times ${b}.` : ' '}</p>
        <Button size="lg" block disabled={!value} onClick={submit}>Open</Button>
        <Button variant="ghost" block onClick={onCancel}>Back</Button>
      </form>
    </div>
  );
}

type Danger = null | 'recordings' | 'history' | 'profile' | 'everything';

export function ParentZone() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const p = useActiveProfile();
  const profiles = useStore((s) => s.profiles);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const patch = useStore((s) => s.patchProfile);
  const store = useStore();
  const [danger, setDanger] = useState<Danger>(null);
  const [recordings, setRecordings] = useState<number | null>(null);
  const [services, setServices] = useState<ApiHealth | null>(null);
  const [code, setCode] = useState(getAccessCode);

  const refresh = () => void audioRepo.count(`${p.id}/`).then(setRecordings);
  useEffect(() => { if (open) { refresh(); void apiHealth().then(setServices); } }, [open, p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return <Gate band={p.band} onPass={() => setOpen(true)} onCancel={() => nav('/me')} />;

  const DANGER: Record<Exclude<Danger, null>, { title: string; body: string; cta: string; run: () => Promise<void> }> = {
    recordings: { title: `Delete ${p.name}’s recordings?`, body: 'All saved voice recordings are erased from this device. Scores and progress are kept.', cta: 'Delete recordings', run: async () => { const n = await store.deleteRecordings(p.id); toast(`${n} recording${n === 1 ? '' : 's'} deleted`, '🗑️'); refresh(); } },
    history: { title: 'Delete pronunciation history?', body: `Recordings, scores, weak-sound memory and review schedule for ${p.name} are erased. Lessons completed, XP and badges are kept.`, cta: 'Delete history', run: async () => { await store.deletePronunciationHistory(p.id); toast('Pronunciation history deleted', '🗑️'); refresh(); } },
    profile: { title: `Delete ${p.name}’s profile?`, body: 'Everything about this learner is erased from this device. This can’t be undone.', cta: 'Delete profile', run: async () => { await store.deleteProfile(p.id); nav('/', { replace: true }); } },
    everything: { title: 'Delete the whole account?', body: 'Every learner, recording, score and setting is erased from this device. This can’t be undone.', cta: 'Delete everything', run: async () => { await store.deleteEverything(); nav('/welcome', { replace: true }); } },
  };

  const toggle = (key: keyof ParentSettings, label: string, detail: string) => (
    <label className="switch-row switch-row--card">
      <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings({ [key]: e.target.checked } as Partial<ParentSettings>)} />
      <span className="switch" aria-hidden /><span><b>{label}</b><small>{detail}</small></span>
    </label>
  );

  return (
    <div className="screen parents">
      <TopBar title={settingsName(p.band)} onBack={() => nav('/me')} />

      <section>
        <h2 className="section-title">Learners</h2>
        <div className="learners">
          {Object.values(profiles).map((c) => (
            <button key={c.id} type="button" className={`learner ${c.id === p.id ? 'is-on' : ''}`} onClick={() => store.setActive(c.id)} aria-pressed={c.id === p.id}><span>{c.avatar}</span><b>{c.name}</b><small>{c.band === 'adult' ? 'Grown-up' : `${c.age} yrs`}</small></button>
          ))}
          <button type="button" className="learner learner--add" onClick={() => nav('/welcome?add=1')}><span><Icon name="plus" /></span><b>Add</b><small>learner</small></button>
        </div>
      </section>

      <section>
        <h2 className="section-title">{p.name}’s learning</h2>
        <div className="form-card">
          <label className="select-row"><span>Age</span>
            <select value={p.band === 'adult' ? 18 : p.age} onChange={(e) => { const age = Number(e.target.value); patch(p.id, { age, band: bandForAge(age) }); }}>{Array.from({ length: 11 }, (_, i) => i + 5).map((n) => <option key={n} value={n}>{n}</option>)}<option value={18}>Grown-up</option></select>
          </label>
          <div className="select-row"><span>Courses</span>
            <span className="course-toggles">
              {(Object.entries(COURSE_NAME) as [CourseId, string][]).map(([id, label]) => {
                const on = p.learning.includes(id);
                return (
                  <button key={id} type="button" className={`chip chip--sm ${on ? 'is-on' : ''}`} aria-pressed={on}
                    onClick={() => { const learning = on ? p.learning.filter((c) => c !== id) : [...p.learning, id]; if (learning.length) patch(p.id, { learning, course: learning.includes(p.course) ? p.course : learning[0] }); }}>
                    {inScript(label, p.zhScript)}
                  </button>
                );
              })}
            </span>
          </div>
          <label className="select-row"><span>English accent</span>
            <select value={p.accent} onChange={(e) => patch(p.id, { accent: e.target.value as Accent })}><option value="en-US">American (most detailed feedback)</option><option value="en-GB">British</option></select>
          </label>
          <label className="select-row"><span>Chinese characters</span>
            <select value={p.zhScript} onChange={(e) => patch(p.id, { zhScript: e.target.value as 'hant' | 'hans' })}><option value="hant">繁體 Traditional</option><option value="hans">简体 Simplified</option></select>
          </label>
          <label className="select-row"><span>Home language</span>
            <select value={p.homeLanguage} onChange={(e) => patch(p.id, { homeLanguage: e.target.value as typeof p.homeLanguage })}>{HOME_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          </label>
        </div>
      </section>

      <section>
        <h2 className="section-title">Voice &amp; privacy</h2>
        {toggle('storeRecordings', 'Keep recordings on this device', 'Lets learners replay “before” and “now”. Only the newest 3 per phrase are kept. Off = audio is discarded right after scoring.')}
        <p className="fineprint fineprint--left">{recordings == null ? 'Counting recordings…' : `${recordings} recording${recordings === 1 ? '' : 's'} stored for ${p.name}. Recordings never leave this device${services?.azure ? ' except to be scored by the speech service, which does not keep them' : ''}.${services?.gemini ? ' The teacher’s voice is made from lesson text only — learners’ voices are never sent for that.' : ''}`}</p>
        <div className="danger-list">
          <button type="button" onClick={() => setDanger('recordings')}><Icon name="trash" size={20} />Delete recordings</button>
          <button type="button" onClick={() => setDanger('history')}><Icon name="trash" size={20} />Delete pronunciation history</button>
          <button type="button" onClick={() => setDanger('profile')}><Icon name="trash" size={20} />Delete {p.name}’s profile</button>
          <button type="button" className="is-strong" onClick={() => setDanger('everything')}><Icon name="trash" size={20} />Delete account &amp; all data</button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Appearance</h2>
        <div className="segmented" role="group" aria-label="Theme">
          {(['auto', 'light', 'dark'] as const).map((t) => <button key={t} type="button" className={settings.theme === t ? 'is-on' : ''} aria-pressed={settings.theme === t} onClick={() => setSettings({ theme: t })}>{t === 'auto' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}</button>)}
        </div>
      </section>

      {services?.needsCode && (
        <section>
          <h2 className="section-title">Beta access</h2>
          <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); setAccessCode(code); window.location.reload(); }}>
            <p className={services.authorized ? 'access access--ok' : 'access'}>
              {services.authorized ? 'Access code accepted — real pronunciation scoring and the teacher voice are on.' : getAccessCode() ? 'That code wasn’t accepted. Check it and try again.' : 'Enter your beta access code to switch on real pronunciation scoring and the teacher voice. Without it the app uses its built-in practice mode.'}
            </p>
            <label className="sr-only" htmlFor="access-code">Beta access code</label>
            <input id="access-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Access code" />
            <Button type="submit" block disabled={!code.trim() || (services.authorized && code.trim() === getAccessCode())}>Save code</Button>
          </form>
        </section>
      )}

      <section>
        <h2 className="section-title">Demo &amp; diagnostics</h2>
        {toggle('demoMic', 'Demo microphone', 'Simulates speaking so the app can be shown on a device without a mic. Scores are not real.')}
        <div className="form-card">
          <label className="select-row"><span>Simulate a problem</span>
            <select value={settings.simulate} onChange={(e) => setSettings({ simulate: e.target.value as ParentSettings['simulate'] })}>
              <option value="none">None</option><option value="network">No internet</option><option value="service">Speech service down</option><option value="slow">Slow scoring</option>
            </select>
          </label>
          <div className="select-row"><span>Pronunciation scoring</span><b>{services == null ? '…' : services.azure ? 'Azure Speech' : 'Built-in practice model'}</b></div>
          <div className="select-row"><span>Teacher voice</span><b>{services == null ? '…' : services.gemini ? 'Gemini Live (native audio)' : 'This device’s voice'}</b></div>
          <div className="select-row"><span>Conversation tutor</span><b>{services == null ? '…' : services.claude ? 'Claude (live)' : 'Scripted'}</b></div>
        </div>
      </section>

      <Sheet open={!!danger} onClose={() => setDanger(null)} label="Confirm delete">
        {danger && (
          <div className="confirm">
            <span className="confirm__icon"><Icon name="trash" size={30} /></span>
            <h2>{DANGER[danger].title}</h2><p>{DANGER[danger].body}</p>
            <Button variant="danger" size="lg" block onClick={() => { const d = danger; setDanger(null); void DANGER[d].run(); }}>{DANGER[danger].cta}</Button>
            <Button variant="ghost" block onClick={() => setDanger(null)}>Cancel</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
