// Where Traditional characters are read (Leslie, 2026-09-25: "for putungua, simplified chinese as default. traditional
// chinese is only need for hk, tw, mo"). Putonghua is taught in Simplified — the scorer's own reference text — and
// only a learner in Hong Kong, Taiwan or Macau is offered Traditional (setup's characters page, Settings' Chinese
// characters row). Read from this device, no permission and no network: the time zone first (it follows where the
// phone is, whatever language it is set to), then the device's languages, then an App language of 繁體中文.

const ZONES = new Set(['Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Macau']);
const TAGS = /^(zh|en|yue)-(hk|tw|mo)\b|^zh-hant\b|^yue\b/i;

export function readsTraditional(appLanguage?: string, env: { timeZone?: string; languages?: readonly string[] } = {}): boolean {
  let zone = env.timeZone;
  if (zone === undefined) { try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zone = ''; } }
  if (zone && ZONES.has(zone)) return true;
  const langs = env.languages ?? (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);
  if (langs.some((l) => TAGS.test(l ?? ''))) return true;
  return appLanguage === 'zh-Hant';
}
