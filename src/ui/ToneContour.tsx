import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { targetContour, type ToneContext } from '../speech/zh/tone';

/** The picture in words, for a screen reader: the line about the tone to teach… */
const SHAPE_LINE: Record<1 | 2 | 3 | 4, Key> = { 1: 'lab.tone.is.1', 2: 'lab.tone.is.2', 3: 'lab.tone.is.3', 4: 'lab.tone.is.4' };

/** …and the line that adds how the learner's own pitch moved (it takes the first line as `{target}`). */
const describe = (c: number[]): Key => {
  const d = c[4] - c[0];
  const min = Math.min(...c);
  if (min < Math.min(c[0], c[4]) - 0.6) return 'lab.tone.yours.dipped';
  if (d > 1) return 'lab.tone.yours.up';
  if (d < -1) return 'lab.tone.yours.down';
  return c.reduce((a, b) => a + b, 0) / c.length > 3.2 ? 'lab.tone.yours.high' : 'lab.tone.yours.low';
};

interface Props {
  /** The tone to teach (1–4). */
  tone: 1 | 2 | 3 | 4;
  /** The learner's pitch on the 1–5 scale at five points, when measured. */
  yours?: number[];
  context?: ToneContext;
  size?: number;
}

/**
 * The tone picture: the target pitch shape (solid) and, when measured, the learner's own (dashed), on the
 * five-level scale Chinese teachers draw on the board.
 */
export function ToneContour({ tone, yours, context = 'alone', size = 132 }: Props) {
  const { t } = useT();
  const W = size, H = Math.round(size * 0.62), padX = 10, padY = 8;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / 4;
  const y = (lvl: number) => padY + ((5 - Math.max(0.6, Math.min(5.4, lvl))) * (H - 2 * padY)) / 4;
  const path = (pts: number[]) => {
    let d = `M ${x(0)} ${y(pts[0])}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = (x(i - 1) + x(i)) / 2;
      d += ` C ${cx} ${y(pts[i - 1])}, ${cx} ${y(pts[i])}, ${x(i)} ${y(pts[i])}`;
    }
    return d;
  };
  const target = targetContour(tone, context);
  const label = yours ? t(describe(yours), { target: t(SHAPE_LINE[tone]) }) : t(SHAPE_LINE[tone]);
  return (
    <figure className="tone" style={{ width: W }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((l) => <line key={l} x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} className="tone__grid" />)}
        <path d={path(target)} className="tone__target" />
        {yours && <path d={path(yours)} className="tone__yours" />}
      </svg>
      <figcaption className="tone__key">
        <span className="tone__key-target">{t('lab.tone.target')}</span>
        {yours && <span className="tone__key-yours">{t('lab.tone.you')}</span>}
      </figcaption>
    </figure>
  );
}
