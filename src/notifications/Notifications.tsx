import { LanguageFlag } from '../ui/LanguageFlag';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DAY, localParts, nextSlot, quietAt, validTimezone, type ReminderPreferences } from '../../notifications/policy.mjs';
import { useActiveProfile, useStore } from '../state/store';
import { dateLocale, type Key } from '../i18n';
import { useT } from '../i18n/useT';
import { badgeName, badgeDetail } from '../engine/rewards';
import { Button, ProgressBar, TopBar } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { currentPreferences, enableReminders, request, saveReminders, stopReminders, support, type ReminderStatus } from './client';
import { deviceTimezone, nextPractice, weeklyProgress } from './model';
import { useReminders } from './preferences';

export function ReminderLink() {
  const { t } = useT(), nav = useNavigate();
  return <button type="button" className="row-link" onClick={() => nav('/notifications')}>
    <span className="row-link__icon"><Icon name="bell" /></span><span><b>{t('notify.title')}</b><small>{t('notify.blurb')}</small></span><Icon name="chevron" size={20} />
  </button>;
}
export function WeeklyChallenge({ compact = false }: { compact?: boolean }) {
  const p = useActiveProfile(), { t } = useT(), nav = useNavigate();
  const progress = weeklyProgress(p, deviceTimezone());
  const complete = progress.days.length >= 3;
  return <section className={'weekly-challenge' + (complete ? ' is-complete' : '')} aria-label={t('notify.challenge')}>
    <div className="weekly-challenge__heading"><span aria-hidden>{complete ? '🌟' : '🌱'}</span><div><b>{t(complete ? 'notify.challengeDone' : 'notify.challenge')}</b><p>{t('notify.challengeProgress', { n: Math.min(3, progress.days.length) })}</p></div></div>
    <div className="week-stamps" aria-label={t('notify.challengeBody')}>{progress.week.map(day => {
      const done = progress.days.includes(day);
      const label = new Date(day + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short' });
      return <span key={day} className={done ? 'is-done' : day === progress.today ? 'is-today' : ''}><small>{label}</small><b aria-label={done ? t('notify.dayDone') : label}>{done ? '✓' : '·'}</b></span>;
    })}</div>
    <p className="fineprint">{t(complete ? 'notify.rest' : 'notify.challengeBody')}</p>
    {compact && <Button variant="ghost" size="sm" onClick={() => nav('/notifications')}>{t('notify.summary')}<Icon name="chevron" size={16} /></Button>}
  </section>;
}
export function ReminderOffer() {
  const { t } = useT(), nav = useNavigate(), p = useActiveProfile();
  const [show, setShow] = useState(() => !useReminders.getState().offered && !useReminders.getState().enabled && Object.keys(p.lessonsCompleted).length === 1);
  useEffect(() => { if (show) useReminders.getState().set({ offered: true }); }, [show]);
  if (!show) return null;
  return <section className="reminder-offer card"><b>{t('notify.offerTitle')}</b><p>{t('notify.offerBody')}</p><div className="notification-actions">
    <Button size="sm" variant="soft" onClick={() => nav('/notifications')}>{t('notify.manage')}</Button>
    <Button size="sm" variant="ghost" onClick={() => setShow(false)}>{t('notify.notNow')}</Button>
  </div></section>;
}
export function Notifications() {
  const { t } = useT(), p = useActiveProfile(), nav = useNavigate();
  const state = useReminders(), profiles = useStore(s => s.profiles), setCourse = useStore(s => s.setCourse);
  const [prefs, setPrefs] = useState<ReminderPreferences>(() => currentPreferences());
  const [follow, setFollow] = useState(state.followTimezone);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<Key | null>(null);
  const [capability, setCapability] = useState(support);
  const courses = [...new Set(Object.values(profiles).flatMap(profile => profile.learning))];
  const progress = weeklyProgress(p, deviceTimezone());
  const next = nextPractice(p, prefs.courses);
  const now = Date.now(), paused = prefs.pauseUntil > now;
  const practiced = progress.days.includes(progress.today);
  const preview = validTimezone(prefs.timezone) && prefs.days.length ? nextSlot(prefs, now) : null;
  const recent = p.achievements.filter(a => a.earnedAt >= now - 7 * DAY).slice(-3).reverse();
  useEffect(() => { void request({ op: 'status' }).then(setStatus).catch(() => undefined); }, []);
  const patch = (value: Partial<ReminderPreferences>) => { setPrefs(old => ({ ...old, ...value })); setMessage(null); };
  const validate = () => prefs.days.length && prefs.courses.length && validTimezone(prefs.timezone)
    && [prefs.time, prefs.quietStart, prefs.quietEnd].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    && !quietAt(prefs.time, prefs.quietStart, prefs.quietEnd);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); }
    catch (e) {
      const code = e instanceof Error ? e.message : 'network';
      setMessage((['auth', 'unavailable', 'denied', 'install', 'unsupported'].includes(code) ? 'notify.' + code : 'notify.network') as Key);
    } finally { setBusy(false); setCapability(support()); }
  };
  const save = (enable = false) => {
    if (!validate()) { setMessage('notify.invalid'); return; }
    // Save timezone preference before resolving the schedule; no permission call happens until Enable is pressed.
    state.set({ offered: true });
    void run(async () => {
      const result = enable ? await enableReminders(prefs, follow) : await saveReminders(prefs, follow);
      setStatus(result); setPrefs(currentPreferences()); setMessage('notify.saved');
    });
  };
  const quick = (value: Partial<ReminderPreferences>) => void run(async () => {
    const changed = { ...state.prefs, ...value }; setStatus(await saveReminders(changed)); setPrefs(changed); setMessage('notify.saved');
  });
  return <div className="screen notifications">
    <TopBar title={t('notify.title')} onBack={() => nav('/me')} />
    <p className="notification-intro">{t('notify.blurb')}</p>
    <WeeklyChallenge />
    <section className="notification-next card">
      <span className="eyebrow">{t('notify.today')}</span><h2>{t(practiced ? 'notify.todayDone' : next?.review ? 'notify.reviewReady' : 'notify.practiceReady')}</h2>
      <p>{t(practiced ? 'notify.rest' : 'notify.smallStep')}</p>
      {next && <Button variant={practiced ? 'soft' : 'primary'} onClick={() => { setCourse(next.course); nav('/lesson/' + next.lesson); }}>{t(practiced ? 'notify.optional' : next.review ? 'notify.review' : 'notify.continue')}</Button>}
    </section>
    <section><h2 className="section-title">{t('notify.summary')}</h2><div className="form-card">
      <div className="select-row"><span>{t('notify.practiceDays')}</span><b>{progress.days.length}</b></div>
      <div className="select-row"><span>{t('notify.weekXp')}</span><b>{progress.xp} XP</b></div>
      <ProgressBar value={Math.min(1, progress.days.length / 3)} tone="leaf" />
      <p className="fineprint">{t('notify.progressDetail')}</p>
    </div>{recent.map(a => <div className="notification-badge card" key={a.id}><span aria-hidden>{a.icon}</span><div><b>{badgeName(a)}</b><p>{badgeDetail(a)}</p></div></div>)}</section>
    <section className="notification-settings"><h2 className="section-title"><Icon name="bell" size={22} /> {t('notify.reminders')}</h2>
      <p>{t('notify.deviceScope')}</p>
      <div className="notification-status" role="status">{t(state.enabled ? paused ? 'notify.paused' : 'notify.on' : 'notify.off')}{status?.enabled && !status.thisDevice && <p>{t('notify.otherDevice')}</p>}</div>
      {capability !== 'supported' && <p className="practice-note">{t(('notify.' + capability) as Key)}</p>}
      <fieldset className="form-card"><legend>{t('notify.days')}</legend><div className="notification-days">{[1, 2, 3, 4, 5, 6, 0].map(day => {
        const label = new Date(2026, 8, 20 + day).toLocaleDateString(dateLocale(), { weekday: 'short' });
        return <button key={day} type="button" aria-pressed={prefs.days.includes(day)} className={'chip ' + (prefs.days.includes(day) ? 'is-on' : '')} onClick={() => patch({ days: prefs.days.includes(day) ? prefs.days.filter(d => d !== day) : [...prefs.days, day].sort() })}>{label}</button>;
      })}</div></fieldset>
      <div className="form-card">
        {(['time', 'quietStart', 'quietEnd'] as const).map(key => <label key={key} className="select-row"><span>{t(('notify.' + key) as Key)}</span><input type="time" value={prefs[key]} onChange={e => patch({ [key]: e.target.value })} /></label>)}
        <label className="switch-row"><input type="checkbox" checked={follow} onChange={e => { setFollow(e.target.checked); if (e.target.checked) patch({ timezone: deviceTimezone() }); }} /><span className="switch" aria-hidden /><span>{t('notify.follow')}</span></label>
        <label className="select-row"><span>{t('notify.timezone')}</span><input value={prefs.timezone} disabled={follow} onChange={e => patch({ timezone: e.target.value })} /></label>
      </div>
      <fieldset className="form-card"><legend>{t('notify.courses')}</legend><div className="notification-courses">{courses.map(course => <label key={course}><input type="checkbox" checked={prefs.courses.includes(course)} onChange={e => patch({ courses: e.target.checked ? [...prefs.courses, course] : prefs.courses.filter(c => c !== course) })} /><LanguageFlag language={course} accent={p.accent} />{t(course === 'en' ? 'common.course.en' : ('settings.me.course.' + course) as Key)}</label>)}</div></fieldset>
      <label className="switch-row switch-row--card"><input type="checkbox" checked={prefs.weekly} onChange={e => patch({ weekly: e.target.checked })} /><span className="switch" aria-hidden /><span><b>{t('notify.weekly')}</b><small>{t('notify.weeklyDetail')}</small></span></label>
      {preview && <p className="fineprint">{t('notify.next', { time: new Date(preview).toLocaleString(dateLocale(), { timeZone: prefs.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
      {message && <p className="notification-message" role="status">{t(message)}</p>}
      <div className="notification-actions">
        <Button disabled={busy} onClick={() => save()} variant="soft">{t('notify.save')}</Button>
        {!state.enabled && <Button disabled={busy || capability !== 'supported'} onClick={() => save(true)}>{t('notify.enable')}</Button>}
        {state.enabled && <Button disabled={busy} variant="ghost" onClick={() => void run(async () => { await stopReminders(); setStatus(null); setMessage('notify.off'); })}>{t('notify.disable')}</Button>}
      </div>
      {state.enabled && <div className="notification-actions">
        <Button size="sm" disabled={busy} variant="ghost" onClick={() => quick({ skipDay: localParts(now, state.prefs.timezone).day })}>{t('notify.skip')}</Button>
        <Button size="sm" disabled={busy} variant="ghost" onClick={() => quick({ pauseUntil: paused ? 0 : now + 7 * DAY, skipDay: '' })}>{t(paused ? 'notify.resume' : 'notify.pause')}</Button>
      </div>}
      <p className="fineprint fineprint--left">{t('notify.private')}</p>
      <p className="fineprint fineprint--left">{t('notify.data')}</p>
      <p className="fineprint fineprint--left">{t('notify.autoPause')}</p>
    </section>
  </div>;
}
