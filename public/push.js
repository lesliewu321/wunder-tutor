// Web Push only. Preferences and the last displayed day survive worker restarts in a tiny private database.
const reminderDb = () => new Promise((resolve, reject) => {
  const r = indexedDB.open('wunder-reminders', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('state');
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});
async function reminderState(change) {
  const db = await reminderDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', change ? 'readwrite' : 'readonly'), store = tx.objectStore('state');
      let result;
      const read = store.get('reminders');
      read.onsuccess = () => {
        const previous = read.result ?? { disabled: true };
        result = change ? change(previous) : previous;
        if (change) store.put(result, 'reminders');
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
function reminderQuiet(prefs, now) {
  if (!prefs) return true;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: prefs.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
    const time = p.hour + ':' + p.minute, a = prefs.quietStart, b = prefs.quietEnd;
    return a === b || (a < b ? time >= a && time < b : time >= a || time < b);
  } catch { return true; }
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'REMINDER_STATE') return;
  const { disabled, practicedDay, skipDay, pauseUntil, prefs } = event.data;
  event.waitUntil(reminderState(s => ({ ...s, disabled: disabled !== false, practicedDay, skipDay, pauseUntil, prefs })));
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let p;
    try { p = event.data?.json(); } catch { return; }
    const now = Date.now();
    if (!p || !['practice', 'review', 'weekly'].includes(p.kind) || typeof p.body !== 'string' || p.body.length > 500
      || !/^\d{4}-\d{2}-\d{2}$/.test(p.day) || !Number.isFinite(p.expiresAt) || p.expiresAt < now || p.expiresAt > now + 10 * 60000) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Server heartbeats normally suppress this; a just-opened tab is checked again here.
    if (windows.some(w => w.visibilityState === 'visible')) return;
    let show = false;
    await reminderState(s => {
      if (s.disabled || s.lastDay === p.day || s.practicedDay === p.day || s.skipDay === p.day || s.pauseUntil > now || reminderQuiet(s.prefs, now)) return s;
      show = true; return { ...s, lastDay: p.day };
    });
    if (!show) return;
    await self.registration.showNotification('Wunder Tutor', {
      body: p.body, icon: '/icon.svg', badge: '/icon.svg',
      tag: 'wunder-learning', renotify: false, silent: true, requireInteraction: false,
      data: { day: p.day, kind: p.kind },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    // A fixed same-origin destination resolves current learner/content, without bypassing profile/account checks.
    const target = new URL('/notifications', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});
