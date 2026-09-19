import type { SpeakItem } from '../domain/types';
import { markSyllable, parseSyllable, splitPinyin, surfaceTones } from '../content/zh/pinyin';

const isHan = (c: string) => /\p{Script=Han}/u.test(c);

/**
 * Pinyin as a child's textbook prints it: dictionary tones, except 一 and 不, whose changed tones are printed
 * (一杯 yì bēi, 不客气 bú kè qi). The 3rd-tone change (你好 ní hǎo) is taught, not printed.
 */
export const displayPinyin = (hans: string, py: string): string[] => {
  const chars = [...hans].filter(isHan);
  const syl = splitPinyin(py);
  const surface = surfaceTones(syl.map((s) => parseSyllable(s).tone), chars);
  return syl.map((s, i) => {
    const said = surface[i]?.accept[0];
    return (chars[i] === '一' || chars[i] === '不') && said && said !== 5 ? markSyllable(`${parseSyllable(s).base}${said}`) : markSyllable(s);
  });
};

export interface ZhMark { tier: 'good' | 'okay' | 'weak' | 'missing'; focus?: boolean; label?: string }

interface Props {
  item: Pick<SpeakItem, 'text' | 'zh'>;
  script: 'hant' | 'hans';
  showPinyin?: boolean;
  /** Result view: one mark per character, and a tap handler to open the character's help sheet. */
  marks?: ZhMark[];
  onTap?: (index: number) => void;
  className?: string;
}

/** Chinese text with pinyin over each character; in the result view each character is a tappable, coloured button. */
export function ZhText({ item, script, showPinyin = true, marks, onTap, className = '' }: Props) {
  if (!item.zh) return <span className={className}>{item.text}</span>;
  const shown = script === 'hant' ? item.zh.hant : item.text;
  const py = displayPinyin(item.text, item.zh.py);
  let k = -1;
  return (
    <span className={`zh ${className}`} lang={script === 'hant' ? 'zh-Hant' : 'zh-Hans'}>
      {[...shown].map((c, i) => {
        if (!isHan(c)) return <span key={i} className="zh__punct">{c}</span>;
        const idx = ++k;
        const m = marks?.[idx];
        const inner = (
          <ruby className="zh__ruby">
            {c}
            <rp>(</rp><rt className="zh__py" aria-hidden={!showPinyin} style={showPinyin ? undefined : { visibility: 'hidden' }}>{py[idx]}</rt><rp>)</rp>
          </ruby>
        );
        if (!m || !onTap) return <span key={i} className="zh__char">{inner}</span>;
        return (
          <button key={i} type="button" className={`zh__char word word--${m.tier} ${m.focus ? 'word--focus' : ''}`} onClick={() => onTap(idx)}
            aria-label={`${c} ${py[idx]}${m.label ? `, ${m.label}` : ''}. Tap for help`}>
            {inner}
          </button>
        );
      })}
    </span>
  );
}
