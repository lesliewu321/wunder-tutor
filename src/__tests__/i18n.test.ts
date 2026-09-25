import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { catalogs, en, LANGUAGES, language, loadLanguage, sentences, setLanguage, t, tc, tl, tm, tn, type Key, type Language } from '../i18n';

const zh = catalogs.interface['zh-Hant']!;
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
    expect(t('settings.account.email.child', { name: 'Tiger' })).toBe('Tiger’s email address');
    setLanguage('zh-Hant');
    expect(language()).toBe('zh-Hant');
    expect(t('settings.account.email.child', { name: 'Tiger' })).toBe('Tiger 的電郵地址');
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

// Leslie, 2026-09-25: "add all the course languages to app language", "traditional and simplified chinese".
describe('App language: every language', () => {
  const FETCHED: Language[] = ['zh-Hans', 'ja', 'ko', 'fr', 'es'];
  const NO_ONE = new Set<Language>(['zh-Hant', 'zh-Hans', 'ja', 'ko']);
  beforeAll(async () => { await Promise.all(FETCHED.map(loadLanguage)); });
  afterEach(() => setLanguage('en'));

  it('offers all seven, in the order of the courses', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'fr', 'es']);
  });

  it.each(FETCHED)('%s translates every line of the interface, keeping placeholders and bold marks', (l) => {
    const own = catalogs.interface[l]!;
    const missing = (Object.keys(en) as Key[]).filter((k) => own[k] == null && !(k.endsWith('.one') && NO_ONE.has(l)));
    expect(missing).toEqual([]);
    expect(Object.keys(own).filter((k) => !(k in en))).toEqual([]);
    const wrong = (Object.keys(own) as Key[]).filter((k) => holes(own[k]!).join() !== holes(en[k]).join() || bolds(own[k]!) !== bolds(en[k]));
    expect(wrong).toEqual([]);
  });

  it.each(FETCHED)('%s translates the wording that lives with data as 繁體中文 does, with the same placeholders', (l) => {
    const hant = catalogs.content['zh-Hant']!, own = catalogs.content[l]!;
    expect(Object.keys(hant).filter((k) => own[k] == null)).toEqual([]);
    expect(Object.keys(own).filter((k) => holes(own[k]!).join() !== holes(hant[k] ?? own[k]!).join())).toEqual([]);
  });

  it('reads a lesson guide in the App language, and in English where a line is not translated', () => {
    const english = Object.keys(catalogs.lessons['zh-Hans']!)[0], hant = '（繁體中文在課程資料裡）';
    expect(english).toBeTruthy();
    setLanguage('zh-Hant');
    expect(tl(english, hant)).toBe(hant);
    for (const l of FETCHED) {
      setLanguage(l);
      expect(tl(english, hant)).toBe(catalogs.lessons[l]![english]);
      expect(tl('A line nobody has translated.', '無')).toBe('A line nobody has translated.');
    }
  });

  it('runs sentences together only in Chinese and Japanese', () => {
    for (const [l, joined] of [['en', 'A. B.'], ['zh-Hans', 'A.B.'], ['ja', 'A.B.'], ['ko', 'A. B.'], ['fr', 'A. B.']] as const) {
      setLanguage(l);
      expect(sentences('A.', 'B.')).toBe(joined);
    }
  });
});

// Leslie, 2026-09-25: the meaning under a practice word "should be translated to app language for all courses".
describe('App language: what a practice word means', () => {
  beforeAll(async () => { await Promise.all((['zh-Hant', 'zh-Hans', 'ja', 'ko', 'fr', 'es'] as Language[]).map(loadLanguage)); });
  afterEach(() => setLanguage('en'));

  it('reads in the App language, from every course', () => {
    setLanguage('zh-Hant');
    expect(tm('croissant', 'fr-FR')).not.toBe('croissant');
    setLanguage('fr');
    expect(tm('hello', 'zh-CN')).not.toBe('hello');
    setLanguage('en');
    expect(tm('a round red or green fruit', undefined)).toBe('a round red or green fruit');
  });

  it('is left out where the App language is the course’s own — it would only repeat the word', () => {
    for (const [l, lang] of [['zh-Hant', 'zh-CN'], ['zh-Hans', 'zh-CN'], ['ja', 'ja-JP'], ['ko', 'ko-KR'], ['fr', 'fr-FR'], ['es', 'es-ES']] as const) {
      setLanguage(l);
      expect(tm('hello', lang)).toBeNull();
    }
  });

  it('shows the English until a meaning is translated', () => {
    setLanguage('ja');
    expect(tm('a meaning nobody wrote yet', 'fr-FR')).toBe('a meaning nobody wrote yet');
    expect(tm(undefined, 'fr-FR')).toBeNull();
  });
});
