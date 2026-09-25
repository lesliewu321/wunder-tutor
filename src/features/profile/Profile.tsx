import { ReminderLink } from '../../notifications/Notifications';
import { LanguageFlag, flagEmoji } from '../../ui/LanguageFlag';
import { TeacherVoiceSelect } from './TeacherVoiceSelect';
import { useEffect, useState } from 'react';
import { handleFor, makeHandle } from '../../engine/handles';
import { readsTraditional } from '../../engine/region';
import { useLocation, useNavigate } from 'react-router-dom';
import { settingsName, type Accent, type AgeBand, type CourseId, type ParentSettings } from '../../domain/types';
import { audioRepo } from '../../data/repository';
import { buildRecordingExport, consentText } from '../../data/exportRecordings';
import { blobToWav16k } from '../../speech/recorder';
import { HOME_LANGUAGES, homeLanguageLabel } from '../../content/translations';
import { DAILY_GOALS, goalDetail, goalLabel, liveStreak } from '../../engine/rewards';
import { LANGUAGES, language, sentences, type Key, type Language } from '../../i18n';
import { rich, useT } from '../../i18n/useT';
import { apiHealth, getAccessCode, serviceStatus, serviceWords, type ApiHealth, type ServiceStatus } from '../../speech';
import { bandForAge, useActiveProfile, useStore } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, Sheet, toast, TopBar, IconButton } from '../../ui/kit';
import { deleteAccount, useAccount } from '../../account/account';
import { forgetContributions } from '../../speech/health';
import { AccountPanel } from './AccountPanel';
import { InviteCodeForm } from './InviteCodeForm';

const BAND_LABEL: Record<AgeBand, Key> = { little: 'settings.me.band.little', junior: 'settings.me.band.junior', teen: 'settings.me.band.teen', adult: 'settings.me.band.adult' };
const COURSES: CourseId[] = ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'];

export function Me() {
  const nav = useNavigate();
  const { t } = useT();
  const p = useActiveProfile();
  const patch = useStore((s) => s.patchProfile);
  const level = Math.floor(p.xp / 100) + 1;
  // Minutes spent speaking out loud, over every day on record.
  const studyMinutes = Math.round(Object.values(p.pronunciation.days).reduce((n, d) => n + (d.speakingMs ?? 0), 0) / 60000);
  const setCourse = useStore((s) => s.setCourse);
  // Every available course can be selected directly; progress remains attached to its course.
  const courseLabel = (id: CourseId) => t(id === 'en' ? 'common.course.en' : ('settings.me.course.' + id) as Key);

  return (
    <div className="screen me">
      <TopBar title={t('settings.me.title')} right={<IconButton className="settings-cog" icon="cog" label={settingsName(p.band)} onClick={() => nav('/parents')} />} />
      {/* One active course, selected from the full available list. */}
      <label className="course-pick"><span><LanguageFlag language={p.course} accent={p.accent} /> {t('home.course.aria')}</span>
        <select value={p.course} onChange={(e) => setCourse(e.target.value as CourseId)}>
          {COURSES.map((id) => <option key={id} value={id}>{flagEmoji(id, p.accent)} {courseLabel(id)}</option>)}
        </select>
      </label>
      <section className="me__card">
        <div className="me__avatar">{p.avatar}</div>
        <h2>{p.name}</h2>
        <p>{t(BAND_LABEL[p.band])}</p>
        <div className="stat-row">
          <div className="stat"><b>{studyMinutes}<small> min</small></b><span>{t('settings.me.studyTime')}</span></div>
          <div className="stat stat--sun"><b>{p.streak.best}</b><span>{t('settings.me.longest')}</span></div>
          <div className="stat stat--coral"><b>{liveStreak(p.streak)}</b><span>{t('settings.me.streak')}</span></div>
        </div>
        <p className="fineprint">{t('settings.me.level')} {level} · {p.xp} XP</p>
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

      <ReminderLink />
      <button type="button" className="row-link" onClick={() => nav('/twisters')}>
        <span className="row-link__icon" aria-hidden>🌀</span>
        <span><b>{t('settings.me.twisters')}</b><small>{t('settings.me.twisters.detail', { handle: handleFor(p, patch) })}</small></span>
        <Icon name="chevron" size={20} />
      </button>
    </div>
  );
}

type Danger = null | 'recordings' | 'history' | 'profile' | 'everything';

/** Settings open straight away: the multiplication question in front of them was removed (Leslie, 2026-09-22). */
export function ParentZone() {
  const nav = useNavigate();
  const { t, tn } = useT();
  const p = useActiveProfile();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const patch = useStore((s) => s.patchProfile);
  const store = useStore();
  const account = useAccount();
  const [danger, setDanger] = useState<Danger>(null);
  const [recordings, setRecordings] = useState<number | null>(null);
  const [services, setServices] = useState<ApiHealth | null>(null);
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
  useEffect(() => { refresh(); void apiHealth().then((h) => { setServices(h); if (h.authorized && (h.azure || h.read)) checkConnections(); }); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show || !services) return;
    // A refused code has no Connections section yet: the code comes first.
    const el = document.getElementById(show === 'connections' ? 'zone-connections' : 'zone-code') ?? document.getElementById('zone-code');
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [show, services]);

  const name = p.name;
  const DANGER: Record<Exclude<Danger, null>, { title: string; body: string; cta: string; run: () => Promise<void> }> = {
    recordings: { title: t('settings.delete.recordings.title', { name }), body: t('settings.delete.recordings.body'), cta: t('settings.delete.recordings.cta'), run: async () => { const n = await store.deleteRecordings(p.id); void forgetContributions(); toast(tn('settings.delete.recordings.done', n), '🗑️'); refresh(); } },
    history: { title: t('settings.delete.history.title'), body: t('settings.delete.history.body', { name }), cta: t('settings.delete.history.cta'), run: async () => { await store.deletePronunciationHistory(p.id); toast(t('settings.delete.history.done'), '🗑️'); refresh(); } },
    profile: { title: t('settings.delete.profile.title', { name }), body: t('settings.delete.profile.body'), cta: t('settings.delete.profile.cta'), run: async () => { await store.deleteProfile(p.id); nav('/', { replace: true }); } },
    everything: { title: t('settings.delete.everything.title'), body: t('settings.delete.everything.body'), cta: t('settings.delete.everything.cta'), run: async () => {
      if (account.status !== 'signed-out' && await deleteAccount()) return toast(t('settings.account.delete.failed'), '⚠️');
      await forgetContributions();
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

  const CONNECTIONS = [['scoring', 'settings.conn.scoring'], ['reading', 'settings.conn.reading'], ['voice', 'settings.conn.voice']] as const;
  const THEMES = [['auto', 'settings.look.theme.auto'], ['light', 'settings.look.theme.light'], ['dark', 'settings.look.theme.dark']] as const;

  return (
    <div className="screen parents">
      <TopBar title={settingsName(p.band)} onBack={() => nav('/me')} />

      <AccountPanel />
      <ReminderLink />

      {services && (services.needsCode || !!getAccessCode()) && (
        <section id="zone-code">
          <h2 className="section-title">{t('settings.beta.title')}</h2>
          <InviteCodeForm services={services} onServices={setServices} />
        </section>
      )}

      <section>
        <h2 className="section-title">{t('settings.look.title')}</h2>
        {/* The app's own wording — never what is being learned. For this device, whoever is learning. */}
        <div className="form-card form-card--gap">
          <label className="select-row"><span><LanguageFlag language={settings.language ?? language()} /> {t('settings.look.language')}</span>
            <select value={language()} onChange={(e) => setSettings({ language: e.target.value as Language })}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{flagEmoji(l.id)} {l.label}</option>)}</select>
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
          {p.learning.includes('en') && (
            <label className="select-row"><span>{t('settings.learning.accent')}</span>
              <select value={p.accent} onChange={(e) => patch(p.id, { accent: e.target.value as Accent })}><option value="en-US">{t('settings.learning.accent.us')}</option><option value="en-GB">{t('settings.learning.accent.gb')}</option></select>
            </label>
          )}
          {p.learning.includes('zh') && readsTraditional(language()) && (
            <label className="select-row"><span>{t('settings.learning.script')}</span>
              <select value={p.zhScript} onChange={(e) => patch(p.id, { zhScript: e.target.value as 'hant' | 'hans' })}><option value="hans">{t('settings.learning.script.hans')}</option><option value="hant">{t('settings.learning.script.hant')}</option></select>
            </label>
          )}
          <label className="select-row"><span><LanguageFlag language={p.homeLanguage} /> {t('settings.learning.home')}</span>
            <select value={p.homeLanguage} onChange={(e) => patch(p.id, { homeLanguage: e.target.value as typeof p.homeLanguage })}>{HOME_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{flagEmoji(l.id)} {homeLanguageLabel(l.id)}</option>)}</select>
          </label>
        </div>
      </section>

      <section id="teacher-voice">
        <h2 className="section-title">{t('settings.demo.voice')}</h2>
        <div className="form-card"><TeacherVoiceSelect services={services} /></div>
      </section>

      <section>
        <h2 className="section-title">{t('settings.voice.title')}</h2>
        {toggle('storeRecordings', t('settings.voice.keep.label'), t('settings.voice.keep.detail'))}
        {toggle('contributeRecordings', t('settings.voice.contribute.label'), t('settings.voice.contribute.detail'))}
        {toggle('shareScores', t('settings.voice.share.label', { name: p.name }), t('settings.voice.share.detail'))}
        <div className="course-pick"><span>{rich(t('settings.voice.share.as', { handle: handleFor(p, patch) }))}</span><Button variant="ghost" size="sm" icon="retry" onClick={() => patch(p.id, { handle: makeHandle() })}>{t('settings.voice.share.reroll')}</Button></div>
        {/* Where recordings go, told truthfully for each case: the privacy line changes with the switch above. */}
        <p className="fineprint fineprint--left">{recordings == null ? t('settings.voice.counting') : sentences(
          tn('settings.voice.stored', recordings, { name }),
          t(!services?.azure ? 'settings.voice.leave.never' : settings.contributeRecordings ? 'settings.voice.leave.kept' : 'settings.voice.leave.scored'),
          (services?.gemini || Object.values(services?.voiceProviders ?? {}).some(Boolean)) && t('settings.voice.teacher'),
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
          <div className="select-row"><span>{t('settings.demo.tutor')}</span><b>{services == null ? '…' : t(services.claude ? 'settings.demo.tutor.claude' : 'settings.demo.tutor.scripted')}</b></div>
          <div className="select-row"><span>{t('settings.demo.version')}</span><b>{__APP_VERSION__}</b></div>
          <Button variant="ghost" onClick={() => { window.location.assign('/parents?update=' + Date.now()); }}>{t('settings.update.reload')}</Button>
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
