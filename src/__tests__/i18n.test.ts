import { afterEach, describe, expect, it } from 'vitest';
import { catalogs, en, language, setLanguage, t, tc, tn, type Key } from '../i18n';

const zh = catalogs.interface['zh-Hant'];
const holes = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const bolds = (text: string): number => (text.match(/\*\*/g) ?? []).length;

describe('App language: the catalogs', () => {
  it('translates every line of the interface (a count only needs its "other" form in Chinese)', () => {
    const missing = (Object.keys(en) as Key[]).filter((k) => zh[k] == null && !(k.endsWith('.one') && zh[k.replace(/\.one$/, '.other')] != null));
    expect(missing).toEqual([]);
  });

  it('has no translation left over for a line that no longer exists', () => {
    expect(Object.keys(zh).filter((k) => !(k in en))).toEqual([]);
  });

  it('keeps every {placeholder} and every **bold** mark in translation', () => {
    const wrong = (Object.keys(zh) as Key[]).filter((k) => k in en && (holes(zh[k]!).join() !== holes(en[k]).join() || bolds(zh[k]!) !== bolds(en[k]) || bolds(zh[k]!) % 2 !== 0));
    expect(wrong).toEqual([]);
  });

  it('never leaves a translation empty, and never leaves English sentences inside the Chinese', () => {
    expect(Object.entries(zh).filter(([, v]) => !v?.trim()).map(([k]) => k)).toEqual([]);
    // Product names, codes and the words being taught may stay in Latin letters; whole English sentences may not.
    const english = Object.entries(zh).filter(([, v]) => /(?:\b[A-Za-z]{3,}\b[ ,.]+){4,}/.test(v ?? '')).map(([k]) => k);
    expect(english).toEqual([]);
  });
});

describe('App language: reading a line', () => {
  afterEach(() => setLanguage('en'));

  it('follows the chosen language and fills in the values', () => {
    expect(t('settings.me.switch.hi', { name: 'Tiger' })).toBe('Hi, Tiger!');
    setLanguage('zh-Hant');
    expect(language()).toBe('zh-Hant');
    expect(t('settings.me.switch.hi', { name: 'Tiger' })).toBe('Tiger，你好！');
  });

  it('counts: English has one/other, Chinese one form for both', () => {
    expect(tn('settings.share.saved', 1)).toBe('Saved 1 recording to a file');
    expect(tn('settings.share.saved', 3)).toBe('Saved 3 recordings to a file');
    setLanguage('zh-Hant');
    expect(tn('settings.share.saved', 1)).toBe('已把 1 段錄音儲存為檔案');
    expect(tn('settings.share.saved', 3)).toBe('已把 3 段錄音儲存為檔案');
  });

  it('shows wording that lives with its data in English until it has a translation', () => {
    expect(tc('homeLanguage.yue', 'Cantonese')).toBe('Cantonese');
    expect(tc('no.such.key', 'Plain English')).toBe('Plain English');
    setLanguage('zh-Hant');
    expect(tc('homeLanguage.yue', 'Cantonese')).toBe('廣東話');
    expect(tc('no.such.key', 'Plain English')).toBe('Plain English');
  });
});
