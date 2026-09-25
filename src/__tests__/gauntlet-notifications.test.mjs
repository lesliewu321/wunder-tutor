import { describe, expect, it } from 'vitest';
import { DAY, LANGS, COURSES, delivery, localParts, nextSlot, preferences, quietAt, wallTimes } from '../../notifications/policy.mjs';
import { ReminderService } from '../../notifications/service.mjs';
import en from '../i18n/en/notifications.json';
import hant from '../i18n/zh-Hant/notifications.json';
import hans from '../i18n/zh-Hans/notifications.json';
import ja from '../i18n/ja/notifications.json';
import ko from '../i18n/ko/notifications.json';
import fr from '../i18n/fr/notifications.json';
import es from '../i18n/es/notifications.json';
const catalogs = { en, 'zh-Hant': hant, 'zh-Hans': hans, ja, ko, fr, es };
const base = { days: [0,1,2,3,4,5,6], time: '18:00', quietStart: '20:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', locale: 'en', courses: COURSES, weekly: false, pauseUntil: 0, skipDay: '' };
const subsets = values => Array.from({ length: (1 << values.length) - 1 }, (_, i) => values.filter((_, bit) => (i + 1) & (1 << bit)));
const device = '00000000-1111-4111-8111-000000000001';
describe('gauntlet: notification permutations', () => {
  it.each(LANGS)('%s validates all 127 course subsets × 127 weekday subsets', locale => {
    for (const courses of subsets(COURSES)) for (const days of subsets(base.days)) {
      const got = preferences({ ...base, locale, courses, days });
      if (got.locale !== locale || got.courses.join() !== courses.join() || got.days.join() !== days.join()) throw Error(JSON.stringify({locale,courses,days}));
    }
  });
  it.each(Intl.supportedValuesOf('timeZone'))('%s schedules at local 18:00 across seasons and year boundary', timezone => {
    for (const date of ['2026-03-08', '2026-07-15', '2026-11-01', '2026-12-31']) {
      const after = Date.parse(date + 'T00:00:00Z'), at = nextSlot({ ...base, timezone }, after);
      expect(at).toBeGreaterThan(after); expect(at - after).toBeLessThanOrEqual(25 * 3600000);
      expect(localParts(at, timezone).time).toBe('18:00');
    }
  });
  it('checks every minute against independent same-day and overnight quiet-hour expectations', () => {
    for (const [a,b] of [[20*60,8*60],[12*60,14*60],[0,0],[0,1]]) for(let n=0;n<1440;n++) {
      const time = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
      const expected = a===b || (a<b ? n>=a && n<b : n>=a || n<b);
      expect(quietAt(time(n), time(a), time(b))).toBe(expected);
    }
  });
  it.each(LANGS)('%s sends each message kind in every course subset with a persistent daily cap', async locale => {
    for (const courses of subsets(COURSES)) for (const kind of ['practice','review','weekly']) {
      let now = wallTimes('2026-09-27','17:00',base.timezone)[0], state, sent=[];
      const store = { read: () => structuredClone(state), write: v => { state=structuredClone(v); }, clear: () => {state=null;}, setAlarm: async()=>{}, deleteAlarm: async()=>{} };
      const service = new ReminderService(store, { now:()=>now, keys:()=>({publicKey:'test-public',privateKey:'test-private'}), send:async(...args)=>{sent.push(args);return 201;} });
      await service.request({op:'key',device});
      await service.request({op:'enable',device,prefs:{...base,locale,courses,weekly:kind==='weekly'},subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'B'+'A'.repeat(86),auth:'A'.repeat(22)}},hasReview:kind==='review',activityDays:['2026-09-26']});
      now+=3600000; await Promise.all([service.alarm(),service.alarm()]); await service.alarm();
      expect(sent).toHaveLength(1); expect(sent[0][2].kind).toBe(kind); expect(sent[0][2].body).toBe(catalogs[locale]['notify.push.'+kind]);
      expect(Object.keys(sent[0][2]).sort()).toEqual(['body','day','expiresAt','kind','tag','title']);
    }
  });
  it('fails closed for cleared/malformed input times instead of throwing in the settings preview', () => {
    for (const time of ['', '24:00', 'oops', undefined]) expect(nextSlot({ ...base, time }, Date.now())).toBe(null);
  });
  it('all suppression conditions dominate every message kind and locale', () => {
    const at = wallTimes('2026-09-27','18:00',base.timezone)[0];
    for (const locale of LANGS) for (const hasReview of [false,true]) for (const weekly of [false,true]) {
      const state = { prefs:{...base,locale,weekly}, nextAt:at, subscription:{}, renewedAt:at-DAY, hasReview, activityDays:['2026-09-26'] };
      for(const patch of [{lastDay:'2026-09-27'},{practicedDays:['2026-09-27']},{activeAt:at-1000},{renewedAt:at-8*DAY},{lastSentAt:at-3600000},{subscription:null},{prefs:{...state.prefs,pauseUntil:at+DAY}},{prefs:{...state.prefs,skipDay:'2026-09-27'}}]) expect(delivery({...state,...patch},at)).toBe(null);
    }
  });
});
