import { Fragment, useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { settingsName, type Accent, type AgeBand, type ChildProfile, type CourseId, type ParentSettings } from '../../domain/types';
import { audioRepo } from '../../data/repository';
import { buildRecordingExport, consentText } from '../../data/exportRecordings';
import { blobToWav16k } from '../../speech/recorder';
import { HOME_LANGUAGES, homeLanguageLabel } from '../../content/translations';
import { inScript } from '../../content/zh/script';
import { DAILY_GOALS, goalDetail, goalLabel, liveStreak } from '../../engine/rewards';
import { LANGUAGES, language, sentences, type Key, type Language } from '../../i18n';
import { rich, useT } from '../../i18n/useT';
import { apiHealth, getAccessCode, redeemInvite, refreshHealth, serviceStatus, serviceWords, type ApiHealth, type InviteAnswer, type ServiceStatus } from '../../speech';
import { bandForAge, useActiveProfile, useStore } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, Sheet, toast, TopBar } from '../../ui/kit';
import { deleteAccount, useAccount } from '../../account/account';
import { AccountPanel } from './AccountPanel';

const BAND_LABEL: Record<AgeBand, Key> = { little: 'settings.me.band.little', junior: 'settings.me.band.junior', teen: 'settings.me.band.teen', adult: 'settings.me.band.adult' };
const COURSES: CourseId[] = ['en', 'zh', 'fr', 'ja'];
/** A course's name on the Me card: English carries the accent; Putonghua and French keep their own names. */
const COURSE_LABEL: Record<Exclude<CourseId, 'en'>, Key> = { zh: 'settings.me.course.zh', fr: 'settings.me.course.fr', ja: 'settings.me.course.ja' };

/**
 * The courses row, looking like the dropdowns around it (Leslie, 2026-09-21). It opens a list to tick rather than being
 * a native <select>: a learner can take more than one course, and a <select> picks one. Changes apply as they are
 * ticked, like the other rows; the last course left cannot be unticked.
 */
function CoursePicker({ p }: { p: ChildProfile }) {
  const { t } = useT();
  const patch = useStore((s) => s.patchProfile);
  const [open, setOpen] = useState(false);
  // Said after trying to untick the only course left, until the next change.
  const [keep, setKeep] = useState(false);
  const id = useId();
  // Putonghua keeps its own name, in the learner's characters (written in Simplified here); French and Japanese theirs.
  const name = (c: CourseId) => (c === 'en' ? t('common.course.en') : c === 'zh' ? inScript('普通话', p.zhScript) : c === 'ja' ? '日本語' : 'Français');
  const lang = (c: CourseId) => (c === 'zh' ? (p.zhScript === 'hans' ? 'zh-Hans' : 'zh-Hant') : c === 'fr' ? 'fr' : c === 'ja' ? 'ja' : undefined);
  // In the list, what the course's own name may not tell the grown-up reading it.
  const gloss = (c: CourseId) => (c === 'fr' || c === 'ja' || (c === 'zh' && language() !== 'zh-Hant') ? t(COURSE_LABEL[c]) : null);
  const toggle = (c: CourseId) => {
    const on = p.learning.includes(c);
    if (on && p.learning.length === 1) { setKeep(true); return; }
    setKeep(false);
    const learning = on ? p.learning.filter((x) => x !== c) : [...p.learning, c];
    patch(p.id, { learning, course: learning.includes(p.course) ? p.course : learning[0] });
  };
  const title = t('settings.learning.courses.title', { name: p.name });
  return (
    <>
      <div className="select-row"><span id={`${id}label`}>{t('settings.learning.courses')}</span>
        <button type="button" className="select-button" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${id}label ${id}value`} onClick={() => { setKeep(false); setOpen(true); }}>
          {/* Three names wrap on a phone: never inside a name (普通話 must not break), and the dot stays with the name before it. */}
          <span id={`${id}value`}>{COURSES.filter((c) => p.learning.includes(c)).map((c, i, all) => <Fragment key={c}>{i > 0 && ' '}<span className="select-button__name"><span lang={lang(c)}>{name(c)}</span>{i < all.length - 1 && <span aria-hidden>{'\u00a0·'}</span>}</span></Fragment>)}</span>
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label={title}>
        <div className="course-sheet">
          <h2>{title}</h2>
          <div className="course-sheet__list">
            {COURSES.map((c) => {
              const on = p.learning.includes(c);
              const more = gloss(c);
              return (
                <button key={c} type="button" className={`tile ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c)}>
                  <span><b lang={lang(c)}>{name(c)}</b>{more && <small>{more}</small>}</span>
                  <span className="tile__tick" aria-hidden>{on && <Icon name="check" size={18} />}</span>
                </button>
              );
            })}
          </div>
          <p className={keep ? 'course-sheet__keep' : undefined} role="status">{t(keep ? 'settings.learning.courses.keep' : 'settings.learning.courses.hint')}</p>
          <Button size="lg" block onClick={() => setOpen(false)}>{t('common.done')}</Button>
        </div>
      </Sheet>
    </>
  );
}

export function Me() {
  const nav = useNavigate();
  const { t } = useT();
  const p = useActiveProfile();
  const profiles = useStore((s) => s.profiles);
  const setActive = useStore((s) => s.setActive);
  const patch = useStore((s) => s.patchProfile);
  const others = Object.values(profiles).filter((x) => x.id !== p.id);
  const level = Math.floor(p.xp / 100) + 1;

  return (
    <div className="screen me">
      <TopBar title={t('settings.me.title')} />
      <section className="me__card">
        <div className="me__avatar">{p.avatar}</div>
        <h2>{p.name}</h2>
        <p>{t(BAND_LABEL[p.band])} · {p.learning.map((c) => t(c === 'en' ? (p.accent === 'en-US' ? 'settings.me.course.enUS' : 'settings.me.course.enGB') : COURSE_LABEL[c])).join(' + ')}</p>
        <div className="stat-row">
          <div className="stat"><b>{level}</b><span>{t('settings.me.level')}</span></div>
          <div className="stat stat--sun"><b>{p.xp}</b><span>{t('settings.me.totalXp')}</span></div>
          <div className="stat stat--coral"><b>{liveStreak(p.streak)}</b><span>{t('settings.me.streak')}</span></div>
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('settings.me.goal.title')}</h2>
        <div className="goal-picker">
          {DAILY_GOALS.map((g) => (
            <button key={g.xp} type="button" className={`tile ${p.dailyGoalXp === g.xp ? 'is-on' : ''}`} aria-pressed={p.dailyGoalXp === g.xp} onClick={() => patch(p.id, { dailyGoalXp: g.xp })}>
              <span><b>{goalLabel(g)}</b><small>{t('settings.me.goal.line', { xp: g.xp, detail: goalDetail(g) })}</small></span>
            </button>
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="section-title">{t('settings.me.switch.title')}</h2>
          <div className="switcher">{others.map((o) => <button key={o.id} type="button" className="switcher__item" onClick={() => { setActive(o.id); toast(t('settings.me.switch.hi', { name: o.name }), o.avatar); nav('/'); }}><span>{o.avatar}</span>{o.name}</button>)}</div>
        </section>
      )}

      <button type="button" className="row-link" onClick={() => nav('/parents')}>
        <span className="row-link__icon"><Icon name="shield" /></span>
        <span><b>{settingsName(p.band)}</b><small>{t('settings.me.zone.detail')}</small></span>
        <Icon name="lock" size={20} />
      </button>
    </div>
  );
}

function Gate({ onPass, onCancel, band }: { onPass: () => void; onCancel: () => void; band: AgeBand }) {
  const { t } = useT();
  const [a, b] = useMemo(() => [6 + Math.floor(Math.random() * 4), 6 + Math.floor(Math.random() * 4)], []);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const submit = () => (Number(value) === a * b ? onPass() : (setWrong(true), setValue('')));
  const adult = band === 'adult';
  return (
    <div className="screen screen--center gate">
      <span className="gate__icon"><Icon name="shield" size={36} /></span>
      <h1>{t(adult ? 'settings.gate.title.adult' : 'settings.gate.title.parent')}</h1>
      <p>{t(adult ? 'settings.gate.prompt.adult' : 'settings.gate.prompt.parent')}</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {/* Spelled out: the × glyph in the display font is easy to misread as +. */}
        <label className="gate__q" htmlFor="gate">{a} <span className="gate__op">{t('settings.gate.times')}</span> {b} = ?</label>
        <input id="gate" className={`input input--center ${wrong ? 'input--wrong' : ''}`} inputMode="numeric" pattern="[0-9]*" autoFocus value={value} onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setWrong(false); }} aria-describedby="gate-msg" />
        <p id="gate-msg" className="gate__msg" role="status">{wrong ? t('settings.gate.wrong', { a, b }) : ' '}</p>
        <Button size="lg" block disabled={!value} onClick={submit}>{t('common.open')}</Button>
        <Button variant="ghost" block onClick={onCancel}>{t('common.back')}</Button>
      </form>
    </div>
  );
}

type Danger = null | 'recordings' | 'history' | 'profile' | 'everything';

export function ParentZone() {
  const nav = useNavigate();
  const { t, tn } = useT();
  const [open, setOpen] = useState(false);
  const p = useActiveProfile();
  const profiles = useStore((s) => s.profiles);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const patch = useStore((s) => s.patchProfile);
  const store = useStore();
  const account = useAccount();
  const [danger, setDanger] = useState<Danger>(null);
  const [recordings, setRecordings] = useState<number | null>(null);
  const [services, setServices] = useState<ApiHealth | null>(null);
  const [code, setCode] = useState(getAccessCode);
  // What the server said about the last code entered: its places and end date if accepted, or why not.
  const [invite, setInvite] = useState<InviteAnswer | 'offline' | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  // Sent here to fix something (the camera's "Enter the code" / "Check connections"): show that part, not the top.
  const show = (useLocation().state as { show?: 'code' | 'connections' } | null)?.show;
  // A live check of the services behind the app: a key can be present and still be refused.
  const [live, setLive] = useState<ServiceStatus | 'checking' | 'failed' | null>(null);
  const checkConnections = () => { setLive('checking'); void serviceStatus().then((s) => setLive(s ?? 'failed')); };
  const attempts = useStore((s) => s.attempts);
  const [sharing, setSharing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [making, setMaking] = useState(false);

  const refresh = () => void audioRepo.count(`${p.id}/`).then(setRecordings);
  useEffect(() => { if (open) { refresh(); void apiHealth().then((h) => { setServices(h); if (h.authorized && (h.azure || h.read)) checkConnections(); }); } }, [open, p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !show || !services) return;
    // A refused code has no Connections section yet: the code comes first.
    const el = document.getElementById(show === 'connections' ? 'zone-connections' : 'zone-code') ?? document.getElementById('zone-code');
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [open, show, services]);

  if (!open) return <Gate band={p.band} onPass={() => setOpen(true)} onCancel={() => nav('/me')} />;

  const name = p.name;
  const DANGER: Record<Exclude<Danger, null>, { title: string; body: string; cta: string; run: () => Promise<void> }> = {
    recordings: { title: t('settings.delete.recordings.title', { name }), body: t('settings.delete.recordings.body'), cta: t('settings.delete.recordings.cta'), run: async () => { const n = await store.deleteRecordings(p.id); toast(tn('settings.delete.recordings.done', n), '🗑️'); refresh(); } },
    history: { title: t('settings.delete.history.title'), body: t('settings.delete.history.body', { name }), cta: t('settings.delete.history.cta'), run: async () => { await store.deletePronunciationHistory(p.id); toast(t('settings.delete.history.done'), '🗑️'); refresh(); } },
    profile: { title: t('settings.delete.profile.title', { name }), body: t('settings.delete.profile.body'), cta: t('settings.delete.profile.cta'), run: async () => { await store.deleteProfile(p.id); nav('/', { replace: true }); } },
    everything: { title: t('settings.delete.everything.title'), body: t('settings.delete.everything.body'), cta: t('settings.delete.everything.cta'), run: async () => {
      if (account.status !== 'signed-out' && await deleteAccount()) return toast(t('settings.account.delete.failed'), '⚠️');
      await store.deleteEverything();
      nav('/welcome', { replace: true });
    } },
  };

  const adult = p.band === 'adult';
  const shareFile = async () => {
    setMaking(true);
    try {
      const out = await buildRecordingExport(p, attempts, (k) => audioRepo.load(k), blobToWav16k);
      if (!out.takes) { toast(t('settings.share.none'), '🎧'); return; }
      const url = URL.createObjectURL(out.file);
      const a = document.createElement('a');
      a.href = url; a.download = out.name; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setSharing(false);
      toast(tn('settings.share.saved', out.takes), '📁');
    } catch {
      toast(t('settings.share.failed'), '⚠️');
    } finally {
      setMaking(false);
    }
  };

  const toggle = (key: keyof ParentSettings, label: string, detail: string) => (
    <label className="switch-row switch-row--card">
      <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings({ [key]: e.target.checked } as Partial<ParentSettings>)} />
      <span className="switch" aria-hidden /><span><b>{label}</b><small>{detail}</small></span>
    </label>
  );

  const betaMessage: Key = services?.authorized ? 'settings.beta.accepted' : !services?.codeSet ? 'settings.beta.noCodeSet' : !services.needsCode ? 'settings.beta.unreachable' : getAccessCode() ? 'settings.beta.refused' : 'settings.beta.prompt';

  /**
   * A code is only kept once the server has given this device a place on it, so the answer is shown as it came:
   * the places taken and the closing date (the urgency Leslie wanted), or exactly why it was turned away.
   */
  const submitCode = async () => {
    setRedeeming(true);
    setInvite(null);
    try {
      const answer = await redeemInvite(code);
      setInvite(answer);
      if (answer.ok) setServices(await refreshHealth());
    } catch {
      setInvite('offline');
    } finally {
      setRedeeming(false);
    }
  };
  const inviteDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(language() === 'zh-Hant' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'short' }) : '');
  const inviteLine = (a: InviteAnswer | 'offline'): { text: string; good: boolean } => {
    if (a === 'offline') return { text: t('settings.beta.unreachable'), good: false };
    const vars = { used: a.used ?? 0, places: a.places ?? 0, date: inviteDate(a.expiresAt) };
    switch (a.reason) {
      case 'new': return { text: t('settings.beta.invite.joined', vars), good: true };
      case 'again': return { text: t('settings.beta.invite.again'), good: true };
      case 'master': return { text: t('settings.beta.accepted'), good: true };
      case 'full': return { text: t('settings.beta.invite.full', vars), good: false };
      case 'expired': return { text: t('settings.beta.invite.expired', vars), good: false };
      case 'disabled': return { text: t('settings.beta.invite.disabled'), good: false };
      default: return { text: t('settings.beta.refused'), good: false };
    }
  };
  const CONNECTIONS = [['scoring', 'settings.conn.scoring'], ['reading', 'settings.conn.reading'], ['voice', 'settings.conn.voice']] as const;
  const THEMES = [['auto', 'settings.look.theme.auto'], ['light', 'settings.look.theme.light'], ['dark', 'settings.look.theme.dark']] as const;

  return (
    <div className="screen parents">
      <TopBar title={settingsName(p.band)} onBack={() => nav('/me')} />

      <section>
        <h2 className="section-title">{t('settings.learners.title')}</h2>
        <div className="learners">
          {Object.values(profiles).map((c) => (
            <button key={c.id} type="button" className={`learner ${c.id === p.id ? 'is-on' : ''}`} onClick={() => store.setActive(c.id)} aria-pressed={c.id === p.id}><span>{c.avatar}</span><b>{c.name}</b><small>{c.band === 'adult' ? t('settings.learners.adult') : t('settings.learners.age', { n: c.age })}</small></button>
          ))}
          <button type="button" className="learner learner--add" onClick={() => nav('/welcome?add=1')}><span><Icon name="plus" /></span><b>{t('settings.learners.add.title')}</b><small>{t('settings.learners.add.sub')}</small></button>
        </div>
      </section>

      <AccountPanel />

      {services && (services.needsCode || !!getAccessCode()) && (
        <section id="zone-code">
          <h2 className="section-title">{t('settings.beta.title')}</h2>
          <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
            {invite
              ? (() => { const line = inviteLine(invite); return <p className={line.good ? 'access access--ok' : 'access access--bad'} role="status">{line.text}</p>; })()
              : <p className={services.authorized ? 'access access--ok' : 'access'}>{t(betaMessage)}</p>}
            <label className="sr-only" htmlFor="access-code">{t('settings.beta.label')}</label>
            <input id="access-code" className="input" value={code} onChange={(e) => { setCode(e.target.value); setInvite(null); }} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={t('settings.beta.placeholder')} />
            <Button type="submit" block disabled={redeeming || !code.trim() || (services.authorized && code.trim() === getAccessCode())}>{t(redeeming ? 'settings.beta.checking' : 'settings.beta.save')}</Button>
          </form>
        </section>
      )}

      <section>
        <h2 className="section-title">{t('settings.look.title')}</h2>
        {/* The app's own wording — never what is being learned. For this device, whoever is learning. */}
        <div className="form-card form-card--gap">
          <label className="select-row"><span>{t('settings.look.language')}</span>
            <select value={language()} onChange={(e) => setSettings({ language: e.target.value as Language })}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          </label>
        </div>
        <div className="segmented" role="group" aria-label={t('settings.look.theme')}>
          {THEMES.map(([id, label]) => <button key={id} type="button" className={settings.theme === id ? 'is-on' : ''} aria-pressed={settings.theme === id} onClick={() => setSettings({ theme: id })}>{t(label)}</button>)}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('settings.learning.title', { name })}</h2>
        <div className="form-card">
          <label className="select-row"><span>{t('settings.learning.age')}</span>
            <select value={p.band === 'adult' ? 18 : p.age} onChange={(e) => { const age = Number(e.target.value); patch(p.id, { age, band: bandForAge(age) }); }}>{Array.from({ length: 13 }, (_, i) => i + 5).map((n) => <option key={n} value={n}>{n}</option>)}<option value={18}>{t('settings.learning.age.adult')}</option></select>
          </label>
          <CoursePicker p={p} />
          <label className="select-row"><span>{t('settings.learning.accent')}</span>
            <select value={p.accent} onChange={(e) => patch(p.id, { accent: e.target.value as Accent })}><option value="en-US">{t('settings.learning.accent.us')}</option><option value="en-GB">{t('settings.learning.accent.gb')}</option></select>
          </label>
          <label className="select-row"><span>{t('settings.learning.script')}</span>
            <select value={p.zhScript} onChange={(e) => patch(p.id, { zhScript: e.target.value as 'hant' | 'hans' })}><option value="hant">{t('settings.learning.script.hant')}</option><option value="hans">{t('settings.learning.script.hans')}</option></select>
          </label>
          <label className="select-row"><span>{t('settings.learning.home')}</span>
            <select value={p.homeLanguage} onChange={(e) => patch(p.id, { homeLanguage: e.target.value as typeof p.homeLanguage })}>{HOME_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{homeLanguageLabel(l.id)}</option>)}</select>
          </label>
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('settings.voice.title')}</h2>
        {toggle('storeRecordings', t('settings.voice.keep.label'), t('settings.voice.keep.detail'))}
        {services?.azure && toggle('contributeRecordings', t('settings.voice.contribute.label'), t('settings.voice.contribute.detail'))}
        {/* Where recordings go, told truthfully for each case: the privacy line changes with the switch above. */}
        <p className="fineprint fineprint--left">{recordings == null ? t('settings.voice.counting') : sentences(
          tn('settings.voice.stored', recordings, { name }),
          t(!services?.azure ? 'settings.voice.leave.never' : settings.contributeRecordings ? 'settings.voice.leave.kept' : 'settings.voice.leave.scored'),
          services?.gemini && t('settings.voice.teacher'),
        )}</p>
        <button type="button" className="row-link row-link--share" disabled={!recordings} onClick={() => { setAgreed(false); setSharing(true); }}>
          <span className="row-link__icon"><Icon name="share" /></span>
          <span><b>{t('settings.share.row.title')}</b><small>{t(recordings ? 'settings.share.row.ready' : 'settings.share.row.empty')}</small></span>
        </button>
        <div className="danger-list">
          <button type="button" onClick={() => setDanger('recordings')}><Icon name="trash" size={20} />{t('settings.delete.recordings')}</button>
          <button type="button" onClick={() => setDanger('history')}><Icon name="trash" size={20} />{t('settings.delete.history')}</button>
          <button type="button" onClick={() => setDanger('profile')}><Icon name="trash" size={20} />{t('settings.delete.profile', { name })}</button>
          <button type="button" className="is-strong" onClick={() => setDanger('everything')}><Icon name="trash" size={20} />{t('settings.delete.everything')}</button>
        </div>
      </section>

      {services?.authorized && (services.azure || services.read) && (
        <section id="zone-connections">
          <h2 className="section-title">{t('settings.conn.title')}</h2>
          <div className="form-card">
            {CONNECTIONS.map(([key, label]) => {
              const state = live && typeof live === 'object' ? live[key] : null;
              return (
                <div key={key} className="select-row">
                  <span>{t(label)}</span>
                  <b className={state == null ? '' : state === 'ok' ? 'conn conn--ok' : state === 'unchecked' ? 'conn' : 'conn conn--bad'}>
                    {live === 'checking' ? t('settings.conn.checking') : live === 'failed' ? t('settings.conn.failed') : state == null ? '…' : `${state === 'ok' ? '✓ ' : state === 'unchecked' ? '' : '✗ '}${serviceWords(state)}`}
                  </b>
                </div>
              );
            })}
            <div className="form-card__action"><Button variant="soft" size="sm" icon="retry" disabled={live === 'checking'} onClick={checkConnections}>{t('settings.conn.again')}</Button></div>
          </div>
          {/* For whoever looks after the server: the services' own words, as they came. */}
          {live && typeof live === 'object' && live.notes && Object.keys(live.notes).length > 0 && (
            <p className="fineprint fineprint--left conn__notes">{Object.entries(live.notes).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
          )}
        </section>
      )}

      <section>
        <h2 className="section-title">{t('settings.demo.title')}</h2>
        {toggle('demoMic', t('settings.demo.mic.label'), t('settings.demo.mic.detail'))}
        <div className="form-card">
          <label className="select-row"><span>{t('settings.demo.simulate')}</span>
            <select value={settings.simulate} onChange={(e) => setSettings({ simulate: e.target.value as ParentSettings['simulate'] })}>
              <option value="none">{t('settings.demo.simulate.none')}</option><option value="network">{t('settings.demo.simulate.network')}</option><option value="service">{t('settings.demo.simulate.service')}</option><option value="slow">{t('settings.demo.simulate.slow')}</option>
            </select>
          </label>
          <div className="select-row"><span>{t('settings.demo.scoring')}</span><b>{services == null ? '…' : t(services.azure ? 'settings.demo.scoring.azure' : 'settings.demo.scoring.builtIn')}</b></div>
          <div className="select-row"><span>{t('settings.demo.voice')}</span><b>{services == null ? '…' : t(services.gemini ? 'settings.demo.voice.gemini' : 'settings.demo.voice.device')}</b></div>
          <div className="select-row"><span>{t('settings.demo.tutor')}</span><b>{services == null ? '…' : t(services.claude ? 'settings.demo.tutor.claude' : 'settings.demo.tutor.scripted')}</b></div>
          <div className="select-row"><span>{t('settings.demo.version')}</span><b>{__APP_VERSION__}</b></div>
        </div>
      </section>

      <Sheet open={sharing} onClose={() => setSharing(false)} label={t('settings.share.sheet')}>
        <div className="confirm confirm--left">
          <span className="confirm__icon"><Icon name="share" size={30} /></span>
          <h2>{adult ? t('settings.share.title.adult') : t('settings.share.title.kid', { name })}</h2>
          <p>{rich(tn(adult ? 'settings.share.body.adult' : 'settings.share.body.kid', recordings ?? 0, { name }))}</p>
          <p>{t('settings.share.nothingSent')}</p>
          <label className="switch-row switch-row--card"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span className="switch" aria-hidden /><span><small>{consentText()}</small></span></label>
          <Button variant="primary" size="lg" block disabled={!agreed || making} onClick={() => void shareFile()}>{t(making ? 'settings.share.making' : 'settings.share.make')}</Button>
          <Button variant="ghost" block onClick={() => setSharing(false)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>

      <Sheet open={!!danger} onClose={() => setDanger(null)} label={t('settings.delete.sheet')}>
        {danger && (
          <div className="confirm">
            <span className="confirm__icon"><Icon name="trash" size={30} /></span>
            <h2>{DANGER[danger].title}</h2><p>{DANGER[danger].body}</p>
            <Button variant="danger" size="lg" block onClick={() => { const d = danger; setDanger(null); void DANGER[d].run(); }}>{DANGER[danger].cta}</Button>
            <Button variant="ghost" block onClick={() => setDanger(null)}>{t('common.cancel')}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
