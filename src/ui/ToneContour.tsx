import { targetContour, type ToneContext } from '../speech/zh/tone';

const SHAPE_WORDS: Record<1 | 2 | 3 | 4, string> = { 1: 'high and flat', 2: 'rising', 3: 'dipping low', 4: 'falling' };

const describe = (c: number[]): string => {
  const d = c[4] - c[0];
  const min = Math.min(...c);
  if (min < Math.min(c[0], c[4]) - 0.6) return 'dipped';
  if (d > 1) return 'went up';
  if (d < -1) return 'went down';
  return c.reduce((a, b) => a + b, 0) / c.length > 3.2 ? 'stayed high' : 'stayed low';
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
  const label = `Tone ${tone} is ${SHAPE_WORDS[tone]}.${yours ? ` Yours ${describe(yours)}.` : ''}`;
  return (
    <figure className="tone" style={{ width: W }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((l) => <line key={l} x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} className="tone__grid" />)}
        <path d={path(target)} className="tone__target" />
        {yours && <path d={path(yours)} className="tone__yours" />}
      </svg>
      <figcaption className="tone__key">
        <span className="tone__key-target">Target</span>
        {yours && <span className="tone__key-yours">You</span>}
      </figcaption>
    </figure>
  );
}
