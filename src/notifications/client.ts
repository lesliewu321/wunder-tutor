import { apiFetch } from '../speech/health';
import { useStore } from '../state/store';
import { language } from '../i18n';
import { hasAccountHere } from '../account/pending';
import { isApp } from '../platform';
import { localParts, type ReminderPreferences } from '../../notifications/policy.mjs';
import { activityDays, deviceTimezone, nextPractice, practiceDays } from './model';
import { reminderDevice, useReminders } from './preferences';

export interface ReminderStatus { enabled: boolean; thisDevice: boolean; nextAt: number | null; prefs: ReminderPreferences | null }
export function support(): 'supported' | 'install' | 'unsupported' | 'denied' {
  if (isApp || !('serviceWorker' in navigator) || !window.isSecureContext) return 'unsupported';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !matchMedia('(display-mode: standalone)').matches && !(navigator as Navigator & { standalone?: boolean }).standalone) return 'install';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : 'supported';
}
export async function request<T = ReminderStatus>(data: Record<string, unknown>): Promise<T> {
  const res = await apiFetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, device: reminderDevice() }), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(res.status === 401 ? 'auth' : res.status === 503 ? 'unavailable' : 'network');
  return res.json() as Promise<T>;
}
function snapshot(prefs: ReminderPreferences) {
  const ps = Object.values(useStore.getState().profiles);
  return { practicedDays: [...new Set(ps.flatMap(p => practiceDays(p, prefs.timezone)))].sort().slice(-15),
    activityDays: [...new Set(ps.flatMap(p => activityDays(p, prefs.timezone)))].sort().slice(-15),
    hasReview: ps.some(p => nextPractice(p, prefs.courses)?.review), active: document.visibilityState === 'visible' };
}
export function currentPreferences(prefs = useReminders.getState().prefs, follow = useReminders.getState().followTimezone): ReminderPreferences {
  return { ...prefs, locale: language(), timezone: follow ? deviceTimezone() : prefs.timezone };
}
export const registerReminderWorker = (): Promise<ServiceWorkerRegistration> => navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(__APP_VERSION__), { scope: '/', updateViaCache: 'none' });
let consentRevision = 0;
export async function enableReminders(prefs: ReminderPreferences, follow = useReminders.getState().followTimezone): Promise<ReminderStatus> {
  const consent = ++consentRevision;
  if (support() !== 'supported') throw new Error(support());
  // Permission remains directly in the user's click call stack (Safari requires this).
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');
  const reg = await registerReminderWorker();
  await navigator.serviceWorker.ready;
  const { publicKey } = await request<{ publicKey: string }>({ op: 'key' });
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(publicKey.length / 4) * 4, '=')), c => c.charCodeAt(0));
  let sub = await reg.pushManager.getSubscription();
  const previous = sub?.options.applicationServerKey;
  if (sub && (!previous || Array.from(new Uint8Array(previous)).join() !== Array.from(key).join())) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const saved = currentPreferences(prefs, follow);
  try {
    if (consent !== consentRevision) throw new Error('cancelled');
    const result = await request({ op: 'enable', subscription: sub.toJSON(), prefs: saved, ...snapshot(saved) });
    if (consent !== consentRevision) {
      await request({ op: 'disable' }).catch(() => undefined);
      throw new Error('cancelled');
    }
    useReminders.getState().set({ enabled: true, offered: true, prefs: saved, followTimezone: follow });
    await swState(false);
    return result;
  } catch (error) { await sub.unsubscribe().catch(() => false); throw error; }
}
export async function saveReminders(prefs: ReminderPreferences, follow = useReminders.getState().followTimezone): Promise<ReminderStatus | null> {
  const saved = currentPreferences(prefs, follow);
  let result: ReminderStatus | null = null;
  if (useReminders.getState().enabled) result = await request({ op: 'update', prefs: saved, ...snapshot(saved) });
  useReminders.getState().set({ prefs: saved, followTimezone: follow });
  await swState(!useReminders.getState().enabled);
  return result;
}
export async function stopReminders(all = false): Promise<void> {
  consentRevision++;
  const enabled = useReminders.getState().enabled;
  useReminders.getState().set({ enabled: false, offered: true });
  if (typeof navigator === 'undefined') return;
  await swState(true);
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    // Unsubscribe even offline or with expired sign-in. The push service rejects the old endpoint.
    await (await reg?.pushManager?.getSubscription())?.unsubscribe();
  } catch { /* A revoked browser permission must not prevent server-side removal. */ }
  if (enabled || all) await request({ op: all ? 'forget' : 'disable' }).catch(() => undefined);
}
async function swState(disabled: boolean): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
  const reg = await navigator.serviceWorker.getRegistration();
  const p = currentPreferences(), today = localParts(Date.now(), p.timezone).day;
  const practiced = snapshot(p).practicedDays.includes(today);
  reg?.active?.postMessage({ type: 'REMINDER_STATE', disabled, practicedDay: practiced ? today : '', skipDay: p.skipDay, pauseUntil: p.pauseUntil, prefs: { timezone: p.timezone, quietStart: p.quietStart, quietEnd: p.quietEnd } });
  if (disabled || practiced) (await reg?.getNotifications({ tag: 'wunder-learning' }))?.forEach(n => n.close());
  } catch { /* Browser storage/permission failures never block learning or server cleanup. */ }
}
let started = false, running = false;
export function startReminders(): void {
  if (started || typeof window === 'undefined' || isApp) return;
  started = true;
  let timer: ReturnType<typeof setTimeout>;
  const sync = async () => {
    if (running) return;
    const state = useReminders.getState();
    if (!state.enabled && !hasAccountHere()) return;
    if (state.enabled && 'Notification' in window && Notification.permission !== 'granted') { await stopReminders(); return; }
    if (navigator.onLine === false) { await swState(!state.enabled); return; }
    running = true;
    try {
      let prefs = currentPreferences();
      if (!state.enabled) {
        const remote = await request({ op: 'status' });
        if (!remote.enabled || !remote.prefs) return;
        prefs = remote.prefs; // Another device's practice is mapped to the recipient's study timezone.
      } else if (prefs.timezone !== state.prefs.timezone || prefs.locale !== state.prefs.locale) await saveReminders(prefs);
      const result = await request({ op: 'heartbeat', ...snapshot(prefs) });
      if (state.enabled && (!result.thisDevice || !result.enabled)) await stopReminders();
      await swState(!state.enabled || !result.thisDevice || !result.enabled);
    } catch { /* Reconcile on next visit; learning works offline. */ }
    finally { running = false; }
  };
  const queue = () => { clearTimeout(timer); timer = setTimeout(() => void sync(), 500); };
  useStore.subscribe((s, prev) => { if (s.profiles !== prev.profiles || s.settings.language !== prev.settings.language) { void swState(!useReminders.getState().enabled); queue(); } });
  window.addEventListener('online', queue);
  document.addEventListener('visibilitychange', queue);
  setInterval(() => { if (document.visibilityState === 'visible') queue(); }, 60000);
  void swState(!useReminders.getState().enabled);
  queue();
}
