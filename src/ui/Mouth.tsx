import { useEffect, useRef, useState } from 'react';
import type { MouthPose } from '../content/phonemes';

const REST: MouthPose = { open: 0.12, round: 0, spread: 0.2, tongue: 'rest', air: 'none', voiced: false };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Front-view mouth diagram driven entirely by numeric pose parameters. It already tweens
 * rest → target → rest; swapping in richer animation later only means changing this renderer.
 */
export function Mouth({ pose, animate = true, size = 200 }: { pose: MouthPose; animate?: boolean; size?: number }) {
  const [t, setT] = useState(animate ? 0 : 1);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) { setT(1); return; }
    const start = performance.now();
    const CYCLE = 3600;
    const loop = (now: number) => {
      const p = ((now - start) % CYCLE) / CYCLE;
      // 0–0.25 move in, hold until 0.8, move out.
      setT(p < 0.25 ? ease(p / 0.25) : p < 0.8 ? 1 : ease(1 - (p - 0.8) / 0.2));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [animate, pose]);

  const open = lerp(REST.open, pose.open, t);
  const round = lerp(REST.round, pose.round, t);
  const spread = lerp(REST.spread, pose.spread, t);
  const active = t > 0.6;

  const cx = 100, cy = 64;
  const halfW = 54 - 27 * round + 11 * spread;
  const halfH = 5 + open * 34 + round * 5;
  const lip = 11 + round * 4;

  const tongue = () => {
    const pink = '#ff8fa3', deep = '#e0667d';
    switch (active ? pose.tongue : 'rest') {
      case 'between-teeth':
        return null; // drawn above the teeth, outside the clip
      case 'ridge':
        return (<g><ellipse cx={cx} cy={cy + halfH * 0.8} rx={halfW * 0.72} ry={halfH * 0.5} fill={deep} /><ellipse cx={cx} cy={cy - halfH * 0.18} rx={halfW * 0.34} ry={halfH * 0.62} fill={pink} /></g>);
      case 'curled-back':
        return <ellipse cx={cx} cy={cy + halfH * 0.45} rx={halfW * 0.42} ry={halfH * 0.42} fill={deep} />;
      case 'low':
        return <ellipse cx={cx} cy={cy + halfH * 0.9} rx={halfW * 0.8} ry={halfH * 0.38} fill={pink} />;
      case 'high-front':
        return <ellipse cx={cx} cy={cy + halfH * 0.35} rx={halfW * 0.78} ry={halfH * 0.7} fill={pink} />;
      case 'high-back':
        return <ellipse cx={cx} cy={cy + halfH * 0.4} rx={halfW * 0.6} ry={halfH * 0.62} fill={deep} />;
      default:
        return <ellipse cx={cx} cy={cy + halfH * 0.85} rx={halfW * 0.75} ry={halfH * 0.5} fill={pink} />;
    }
  };

  const teethH = Math.min(13, halfH * 0.75);
  const showTongueOut = active && pose.tongue === 'between-teeth';
  const showTeethOnLip = active && pose.teethOnLip;

  return (
    <svg className="mouth" width={size} height={size * 0.93} viewBox="25 0 150 140" role="img" aria-label="Mouth position">
      <defs><clipPath id="mouth-clip"><ellipse cx={cx} cy={cy} rx={halfW} ry={halfH} /></clipPath></defs>

      {active && pose.air === 'nose' && (
        <g className="mouth__air" fill="none" stroke="var(--sky)" strokeWidth="3.5" strokeLinecap="round">
          <path d="M92 26 q-4 -7 0 -14" /><path d="M108 26 q4 -7 0 -14" />
        </g>
      )}

      {/* lips */}
      <ellipse cx={cx} cy={cy} rx={halfW + lip} ry={halfH + lip} fill="#f2788a" />
      <ellipse cx={cx} cy={cy} rx={halfW} ry={halfH} fill="#5a1e33" />

      <g clipPath="url(#mouth-clip)">
        {tongue()}
        <rect x={cx - halfW} y={cy - halfH - 2} width={halfW * 2} height={teethH + 2} rx="5" fill="#fff" />
        {open > 0.5 && <rect x={cx - halfW * 0.7} y={cy + halfH - 7} width={halfW * 1.4} height="9" rx="4" fill="#fff" opacity=".95" />}
      </g>

      {showTongueOut && (
        <g>
          <ellipse cx={cx} cy={cy + 3} rx="24" ry={Math.max(8, halfH * 0.75)} fill="#ff8fa3" />
          <path d={`M ${cx} ${cy - 2} v ${Math.max(6, halfH * 0.8)}`} stroke="#e0667d" strokeWidth="2" strokeLinecap="round" />
          <rect x={cx - halfW * 0.85} y={cy - halfH - 2} width={halfW * 1.7} height={teethH} rx="5" fill="#fff" />
        </g>
      )}
      {showTeethOnLip && <rect x={cx - 26} y={cy - halfH - 2} width="52" height={halfH * 2 + 7} rx="6" fill="#fff" stroke="#eadfe2" strokeWidth="1.5" />}

      {active && pose.tongue === 'curled-back' && (
        <g fill="none" stroke="var(--sun)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${cx + 14} ${cy + halfH * 0.2} q 10 -14 -8 -16`} /><path d={`M ${cx + 12} ${cy - halfH * 0.2 - 12} l -7 0.5 l 3 6`} />
        </g>
      )}

      {active && pose.air === 'stream' && (
        <g className="mouth__air mouth__air--stream" fill="none" stroke="var(--sky)" strokeWidth="3.5" strokeLinecap="round">
          <path d={`M ${cx - 18} ${cy + halfH + lip + 8} q -5 12 -1 24`} /><path d={`M ${cx} ${cy + halfH + lip + 8} q 4 12 0 26`} /><path d={`M ${cx + 18} ${cy + halfH + lip + 8} q 5 12 1 24`} />
        </g>
      )}
      {active && pose.air === 'puff' && (
        <g className="mouth__air mouth__air--puff" fill="none" stroke="var(--sky)" strokeWidth="3.5" strokeLinecap="round">
          <path d={`M ${cx - 14} ${cy + halfH + lip + 8} l -7 12`} /><path d={`M ${cx} ${cy + halfH + lip + 9} v 14`} /><path d={`M ${cx + 14} ${cy + halfH + lip + 8} l 7 12`} />
        </g>
      )}
    </svg>
  );
}
