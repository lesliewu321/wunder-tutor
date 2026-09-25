export const DAY = 86_400_000;
export const LANGS = ['en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'fr', 'es'];
export const COURSES = ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'];
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
const formatters = new Map();
export function localParts(at, timezone) {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (formatters.size > 100) formatters.clear();
    formatters.set(timezone, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function validTimezone(zone) {
  try { if (typeof zone !== 'string' || zone.length > 80) return false; localParts(0, zone); return true; } catch { return false; }
}
export function addDays(day, n) { return new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10); }
export function weekday(day) { return new Date(`${day}T12:00:00Z`).getUTCDay(); }
export function weekStart(day) { return addDays(day, -((weekday(day) + 6) % 7)); }
export function quietAt(time, start, end) { return start === end || (start < end ? time >= start && time < end : time >= start || time < end); }
export function preferences(raw) {
  if (!raw || !Array.isArray(raw.days) || !raw.days.length || raw.days.length > 7 || !raw.days.every(n => Number.isInteger(n) && n >= 0 && n <= 6)
    || !clock.test(raw.time) || !clock.test(raw.quietStart) || !clock.test(raw.quietEnd) || !validTimezone(raw.timezone)
    || !LANGS.includes(raw.locale) || !Array.isArray(raw.courses) || !raw.courses.length || raw.courses.length > COURSES.length || !raw.courses.every(c => COURSES.includes(c))) throw new Error('invalid_preferences');
  return { days: [...new Set(raw.days)].sort(), time: raw.time, quietStart: raw.quietStart, quietEnd: raw.quietEnd,
    timezone: raw.timezone, locale: raw.locale, courses: [...new Set(raw.courses)], weekly: raw.weekly === true,
    pauseUntil: Number.isFinite(raw.pauseUntil) ? Math.min(Date.now() + 31 * DAY, Math.max(0, raw.pauseUntil)) : 0,
    skipDay: typeof raw.skipDay === 'string' && date.test(raw.skipDay) ? raw.skipDay : '' };
}
// Calendar wall time -> UTC, including half-hour offsets and DST. A missing spring-forward time is skipped;
// the first occurrence of an autumn repeated time owns the slot (the daily ledger prevents a second delivery).
export function wallTimes(day, time, timezone) {
  const wall = Date.parse(`${day}T${time}:00Z`);
  const offsets = new Set([-36, 0, 36].map(h => {
    const probe = wall + h * 3600000, p = localParts(probe, timezone);
    return Date.parse(`${p.day}T${p.time}:00Z`) - probe;
  }));
  return [...offsets].map(o => wall - o).filter(at => { const p = localParts(at, timezone); return p.day === day && p.time === time; }).sort((a, b) => a - b);
}
export function nextSlot(p, after) {
  // Time inputs are temporarily empty while edited; keep the settings preview safe.
  if (!p || !clock.test(p.time) || !clock.test(p.quietStart) || !clock.test(p.quietEnd) || !validTimezone(p.timezone) || !Number.isFinite(after)) return null;
  const start = localParts(after, p.timezone).day;
  for (let i = 0; i < 9; i++) {
    const day = addDays(start, i);
    if (!(p.days.includes(weekday(day)) || (p.weekly && weekday(day) === 0)) || p.skipDay === day || quietAt(p.time, p.quietStart, p.quietEnd)) continue;
    const at = wallTimes(day, p.time, p.timezone)[0];
    if (at > after && at >= p.pauseUntil) return at;
  }
  return null;
}
export function delivery(state, now) {
  const p = state.prefs;
  if (!state.subscription || !p || !state.nextAt || now < state.nextAt || now - state.nextAt > 10 * 60000 || now > state.renewedAt + 7 * DAY) return null;
  const { day, time } = localParts(now, p.timezone);
  if (state.lastDay === day || now - (state.lastSentAt ?? 0) < 20 * 3600000 || now < p.pauseUntil || day === p.skipDay
    || quietAt(time, p.quietStart, p.quietEnd) || now - (state.activeAt ?? 0) < 120000 || (state.practicedDays ?? []).includes(day)) return null;
  if (p.weekly && weekday(day) === 0 && (state.activityDays ?? []).some(d => d >= weekStart(day) && d < day)) return 'weekly';
  if (!p.days.includes(weekday(day))) return null;
  return state.hasReview ? 'review' : 'practice';
}
