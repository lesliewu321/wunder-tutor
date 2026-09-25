import webpush from 'web-push';
import { DAY, addDays, delivery, localParts, nextSlot, preferences } from './policy.mjs';
import en from '../src/i18n/en/notifications.json';
import hant from '../src/i18n/zh-Hant/notifications.json';
import hans from '../src/i18n/zh-Hans/notifications.json';
import ja from '../src/i18n/ja/notifications.json';
import ko from '../src/i18n/ko/notifications.json';
import fr from '../src/i18n/fr/notifications.json';
import es from '../src/i18n/es/notifications.json';
const catalogs = { en, 'zh-Hant': hant, 'zh-Hans': hans, ja, ko, fr, es };
const uuid = /^[a-f0-9-]{36}$/i;
// Never let a subscription become an arbitrary server-side HTTP request. These are browser push services only.
export function subscription(raw) {
  const url = new URL(raw?.endpoint ?? '');
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
    || host === 'web.push.apple.com' || host.endsWith('.push.apple.com')
    || host === 'wns.windows.com' || host.endsWith('.notify.windows.com');
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !allowed || url.href.length > 2048
    || !/^[\w-]{87}$/.test(raw?.keys?.p256dh ?? '') || !/^[\w-]{22}$/.test(raw?.keys?.auth ?? '')) throw new Error('invalid_subscription');
  return { endpoint: url.href, keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth } };
}
export async function sendPush(sub, keys, payload, fetchImpl = fetch) {
  const req = webpush.generateRequestDetails(sub, JSON.stringify(payload), {
    vapidDetails: { subject: 'https://app.wundertutor.com', ...keys }, TTL: 300, urgency: 'low', topic: 'wunder-learning',
  });
  const response = await fetchImpl(req.endpoint, { method: 'POST', headers: req.headers, body: req.body, redirect: 'error', signal: AbortSignal.timeout(10000) });
  await response.body?.cancel();
  return response.status;
}
// The store has synchronous read/write backed by SQLite. Each change is saved before any await; requests cannot
// overwrite a newer opt-out or daily ledger while push delivery is in flight. No subscription/key is returned.
export class ReminderService {
  constructor(store, { now = Date.now, send = sendPush, keys = () => webpush.generateVAPIDKeys() } = {}) { Object.assign(this, { store, now, send, keys }); }
  state() { return this.store.read() ?? {}; }
  publicState(s, device) { return { enabled: !!s.subscription, thisDevice: s.device === device, nextAt: s.nextAt ?? null, prefs: s.prefs ?? null }; }
  async request(input) {
    if (!uuid.test(input?.device ?? '')) throw new Error('invalid_device');
    const now = this.now(), device = input.device;
    let s = this.state();
    if (input.op === 'status') return this.publicState(s, device);
    if (input.op === 'key') {
      if (!s.keys) { s = { ...s, keys: this.keys(), renewedAt: now }; this.store.write(s); await this.schedule(); }
      return { publicKey: s.keys.publicKey };
    }
    if (input.op === 'disable' || input.op === 'forget') {
      if (input.op === 'forget' || s.device === device) {
        // Retain only the daily ledger and signing key briefly, so off/on cannot create duplicates.
        s = { keys: s.keys, lastDay: s.lastDay, lastSentAt: s.lastSentAt, renewedAt: now };
        this.store.write(s); await this.schedule();
      }
      return this.publicState(s, device);
    }
    if (input.op === 'enable') {
      if (!s.keys) throw new Error('key_required');
      s = { ...s, prefs: preferences(input.prefs), subscription: subscription(input.subscription), device, renewedAt: now };
    } else if (input.op === 'update') {
      if (!s.subscription || s.device !== device) throw new Error('not_primary');
      s = { ...s, prefs: preferences(input.prefs), renewedAt: now };
    } else if (input.op === 'heartbeat') {
      if (!s.subscription) return this.publicState(s, device);
      // A second signed-in device may suppress today's reminder but must not take over the schedule.
      s = { ...s, renewedAt: now };
    } else throw new Error('invalid_operation');
    const today = localParts(now, s.prefs.timezone).day;
    const days = (values) => Array.isArray(values) ? values.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= addDays(today, -14) && d <= today).slice(-15) : [];
    s.practicedDays = [...new Set([...days(s.practicedDays), ...days(input.practicedDays)])];
    s.activityDays = [...new Set([...days(s.activityDays), ...days(input.activityDays)])];
    if (input.active === true) s.activeAt = now;
    if (s.device === device) s.hasReview = input.hasReview === true;
    this.store.write(s);
    await this.schedule();
    return this.publicState(this.state(), device);
  }
  async schedule() {
    const s = this.state(), now = this.now();
    // Clean up abandoned registrations and their private signing keys. Returning users can opt in again.
    const expires = (s.renewedAt ?? now) + 30 * DAY;
    const slot = s.subscription && now < s.renewedAt + 7 * DAY ? nextSlot(s.prefs, now) : null;
    const nextAt = slot && slot <= s.renewedAt + 7 * DAY ? slot : null;
    this.store.write({ ...s, nextAt });
    await this.store.setAlarm(Math.max(now + 1000, nextAt ?? expires));
  }
  async alarm() {
    const now = this.now();
    let s = this.state();
    if (now >= (s.renewedAt ?? 0) + 30 * DAY) { this.store.clear(); await this.store.deleteAlarm(); return; }
    const kind = delivery(s, now);
    if (kind) {
      const words = catalogs[s.prefs.locale] ?? en;
      // Commit before sending. A failed/ambiguous attempt is never retried that day: missing one is better than two.
      s = { ...s, lastDay: localParts(now, s.prefs.timezone).day, lastSentAt: now };
      this.store.write(s);
      const sub = s.subscription;
      await this.schedule();
      try {
        const status = await this.send(sub, s.keys, { title: 'Wunder Tutor', body: words[`notify.push.${kind}`],
          kind, day: s.lastDay, expiresAt: now + 5 * 60000, tag: 'wunder-learning' });
        const current = this.state();
        if ((status === 404 || status === 410) && current.subscription?.endpoint === sub.endpoint) {
          this.store.write({ ...current, subscription: null, device: null }); await this.schedule();
        }
      } catch { /* No payloads, endpoints, tokens or keys in logs. The next scheduled day remains available. */ }
    } else await this.schedule();
  }
}
