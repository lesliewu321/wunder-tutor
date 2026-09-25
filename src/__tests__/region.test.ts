import { describe, expect, it } from 'vitest';
import { readsTraditional } from '../engine/region';

// Leslie, 2026-09-25: "for putungua, simplified chinese as default. traditional chinese is only need for hk, tw, mo".
describe('who is offered Traditional characters', () => {
  it('a phone in Hong Kong, Taipei or Macau, whatever its language', () => {
    for (const timeZone of ['Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Macau']) expect(readsTraditional('en', { timeZone, languages: ['en-US'] })).toBe(true);
  });
  it('a phone set to a Hong Kong, Taiwan or Macau language, or to 繁體中文 in the app', () => {
    for (const lang of ['zh-HK', 'zh-TW', 'en-HK', 'zh-Hant', 'yue']) expect(readsTraditional('en', { timeZone: 'Europe/London', languages: [lang] })).toBe(true);
    expect(readsTraditional('zh-Hant', { timeZone: 'Europe/London', languages: ['en-GB'] })).toBe(true);
  });
  it('nobody else: mainland China, Singapore, everyone learning from abroad', () => {
    expect(readsTraditional('zh-Hans', { timeZone: 'Asia/Shanghai', languages: ['zh-CN'] })).toBe(false);
    expect(readsTraditional('en', { timeZone: 'Asia/Singapore', languages: ['en-SG', 'zh-SG'] })).toBe(false);
    expect(readsTraditional('ja', { timeZone: 'Asia/Tokyo', languages: ['ja-JP'] })).toBe(false);
  });
});
