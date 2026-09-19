import { afterEach, describe, expect, it } from 'vitest';
import { exampleSpeech, phonemeInfo, tipFor } from '../content/phonemes';
import { ZH_SOUNDS } from '../content/zh/sounds';
import { HANT, setDisplayScript, shownText } from '../content/zh/script';
import { ZH_COURSE, ZH_ITEMS } from '../content/zh/course';
import { unitTitle } from '../content/course';

// Characters written the same way in Simplified and Traditional. A new character in the sound guides must be added
// here or to HANT (content/zh/script.ts), or Traditional readers would see a Simplified one.
const SAME = new Set([...'麻你好大是四知西姨路男山金京吃的我家人物校食']);

describe('Mandarin copy in the learner’s script', () => {
  afterEach(() => setDisplayScript('hant'));

  it('knows the Traditional form of every character the sound guides and unit names use', () => {
    const text = [
      ...ZH_SOUNDS.flatMap((p) => [p.example, p.problem, p.detail, ...p.steps, ...Object.values(p.tip)]),
      ...ZH_COURSE.units.flatMap((u) => [u.title, u.subtitle, u.grownUp?.title ?? '', u.grownUp?.subtitle ?? '']),
    ].join('');
    const unknown = [...new Set(text.match(/\p{Script=Han}/gu) ?? [])].filter((c) => !HANT[c] && !SAME.has(c));
    expect(unknown).toEqual([]);
  });

  it('shows guides in the active script but always speaks the scorer’s characters', () => {
    setDisplayScript('hant');
    expect(phonemeInfo('zh:t1').example).toBe('媽 mā');
    expect(tipFor('zh:-ng', 'teen')).not.toMatch(/[汤贪伤]/u);
    expect(exampleSpeech('zh:t1')).toBe('妈');
    setDisplayScript('hans');
    expect(phonemeInfo('zh:t1').example).toBe('妈 mā');
    expect(exampleSpeech('zh:-ng')).toBe('汤');
    // English examples are spoken whole.
    expect(exampleSpeech('θ')).toBe(phonemeInfo('θ').example);
  });

  it('names units plainly for grown-ups, in their script', () => {
    const food = ZH_COURSE.units[0];
    expect(unitTitle(food, 'junior')).toBe('Yummy Food 好吃的');
    expect(unitTitle(food, 'adult')).toBe('Food & Drink 飲食');
    setDisplayScript('hans');
    expect(unitTitle(food, 'teen')).toBe('Food & Drink 饮食');
  });

  it('shows practice items in the active script', () => {
    const bread = ZH_ITEMS.find((i) => i.text === '面包')!;
    expect(shownText(bread, 'hant')).toBe('麵包');
    expect(shownText(bread, 'hans')).toBe('面包');
    expect(shownText({ text: 'apple' }, 'hant')).toBe('apple');
  });
});

describe('teacher take tone check', () => {
  it('reads a 16-bit WAV and lets through what it cannot judge', async () => {
    const { wavSamples, teacherToneOk } = await import('../speech/zh/teacherCheck');
    const rate = 24000, n = 2400;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(8000 * Math.sin((2 * Math.PI * 200 * i) / rate)), true);
    const pcm = wavSamples(buf)!;
    expect(pcm.rate).toBe(rate);
    expect(pcm.samples).toHaveLength(n);
    expect(wavSamples(new ArrayBuffer(10))).toBeNull();
    // Phrases, unknown voices and too-short audio are never rejected.
    expect(teacherToneOk(buf, '我想喝水', 'Kore')).toBe(true);
    expect(teacherToneOk(buf, '水', 'SomeOtherVoice')).toBe(true);
    expect(teacherToneOk(buf, '水', 'Kore')).toBe(true);
  });
});
