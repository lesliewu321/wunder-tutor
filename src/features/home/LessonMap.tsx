import type { ReactNode } from 'react';
import type { AgeBand } from '../../domain/types';
import { Icon } from '../../ui/Icon';
import { Mascot } from '../../ui/Mascot';

// The lessons of a unit as a walk through a landscape (Leslie, 2026-09-25: a lessons overview like SuperChinese's,
// "make it interesting, not just zigzag", "do not copy exactly, make it compatible with our current theme",
// "background should be different per age group"). The scene is drawn from the app's own palette — cream, lilac,
// leaf, sky — and changes with the learner's age band: a meadow for little ones, a mountain trail for juniors, a calm
// contour map for teens and grown-ups. Round nodes sit on a trail that meanders rather than zigzags, with the same
// states the list has — done, up next, open, locked — and Tutu waits beside the next lesson. It scrolls with the page.

export interface MapNode {
  id: string;
  icon: ReactNode;
  title: string;
  sub?: string;
  state: 'done' | 'current' | 'open' | 'locked';
  /** Stars earned (children) — shown on the circle's shoulder. */
  stars?: number;
  /** A test's best score. */
  score?: number;
  /** A tick for a grown-up's finished lesson, a play mark for the next one. */
  mark?: 'tick' | 'play';
  onClick: () => void;
}

export type MapScene = 'meadow' | 'trail' | 'route';
export const sceneFor = (band: AgeBand): MapScene => (band === 'little' ? 'meadow' : band === 'junior' ? 'trail' : 'route');

/** Where the trail wanders, left to right, as a percentage: no two neighbours alike, no straight zigzag. */
const XS = [50, 72, 58, 26, 42, 74, 30, 56, 24, 68, 46, 72];
/** The gap to the next node, with a little unevenness so the walk breathes. */
const STEPS = [124, 138, 118, 132, 126, 140, 120];
const TOP = 64;
/** Things beside the trail, on the side the trail is not: one per node, in this order, per scene. */
const SCENERY: Record<MapScene, string[]> = {
  meadow: ['🌳', '🌸', '🦋', '🍄', '🐿️', '🌷', '🐝', '🌼', '🐞', '🌳', '🐰', '🌻'],
  trail: ['🌲', '⛰️', '🏕️', '🪨', '🦅', '🌉', '🔥', '🦌', '🌲', '🗻', '🦉', '🌲'],
  route: [],
};

export function LessonMap({ nodes, label, unitIcon, scene }: { nodes: MapNode[]; label: string; unitIcon?: string; scene: MapScene }) {
  const ys: number[] = [];
  nodes.forEach((_, i) => ys.push(i === 0 ? TOP : ys[i - 1] + STEPS[(i - 1) % STEPS.length]));
  const flagY = (ys[ys.length - 1] ?? TOP) + 118;
  const height = flagY + (scene === 'route' ? 90 : 120); // room for the flag, and a lake under it on the picture scenes
  const centre = (i: number) => ({ x: XS[i % XS.length], y: ys[i] });
  // One smooth trail through every centre and on to the flag: vertical tangents, so it leaves and arrives straight.
  const points = [...nodes.map((_, i) => centre(i)), { x: 50, y: flagY }];
  const d = points.map((c, i) => {
    if (i === 0) return `M ${c.x} ${c.y}`;
    const p = points[i - 1];
    const gap = c.y - p.y;
    return `C ${p.x} ${p.y + gap / 2}, ${c.x} ${c.y - gap / 2}, ${c.x} ${c.y}`;
  }).join(' ');
  const lakeTop = height - 104;
  const scenery = SCENERY[scene];
  const tutuSize = scene === 'route' ? 46 : 58;
  const fill = scene === 'meadow' ? 'url(#map-sky)' : scene === 'trail' ? 'url(#map-dusk)' : 'url(#map-calm)';

  return (
    <div className={`map map--${scene}`} style={{ height }} role="list" aria-label={label}>
      <svg className="map__scene" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="map-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sky-soft)" /><stop offset="1" stopColor="var(--bg)" /></linearGradient>
          <linearGradient id="map-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--primary-soft)" /><stop offset="1" stopColor="var(--sun-soft)" /></linearGradient>
          <linearGradient id="map-calm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--surface-2)" /><stop offset="1" stopColor="var(--primary-soft)" /></linearGradient>
          <linearGradient id="map-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sky-soft)" /><stop offset="1" stopColor="color-mix(in srgb, var(--sky) 38%, white)" /></linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height={height} fill={fill} />
        {scene === 'meadow' && (
          <>
            {/* Rolling hills, softer behind, a little greener in front. */}
            <path d={`M 0 ${height * 0.34} C 18 ${height * 0.30}, 30 ${height * 0.39}, 48 ${height * 0.35} S 78 ${height * 0.29}, 100 ${height * 0.34} L 100 ${height} L 0 ${height} Z`} fill="var(--leaf-soft)" opacity="0.9" />
            <path d={`M 0 ${height * 0.62} C 14 ${height * 0.57}, 34 ${height * 0.67}, 52 ${height * 0.62} S 84 ${height * 0.56}, 100 ${height * 0.61} L 100 ${height} L 0 ${height} Z`} fill="color-mix(in srgb, var(--leaf) 22%, var(--leaf-soft))" />
          </>
        )}
        {scene === 'trail' && (
          <>
            {/* Far peaks, then wooded slopes. */}
            <path d={`M 0 ${height * 0.30} L 14 ${height * 0.22} L 26 ${height * 0.28} L 40 ${height * 0.18} L 54 ${height * 0.27} L 68 ${height * 0.21} L 82 ${height * 0.29} L 100 ${height * 0.23} L 100 ${height} L 0 ${height} Z`} fill="color-mix(in srgb, var(--primary) 16%, var(--primary-soft))" opacity="0.8" />
            <path d={`M 0 ${height * 0.46} C 16 ${height * 0.41}, 30 ${height * 0.50}, 50 ${height * 0.45} S 82 ${height * 0.40}, 100 ${height * 0.46} L 100 ${height} L 0 ${height} Z`} fill="var(--leaf-soft)" />
            <path d={`M 0 ${height * 0.70} C 14 ${height * 0.65}, 34 ${height * 0.75}, 52 ${height * 0.70} S 84 ${height * 0.64}, 100 ${height * 0.69} L 100 ${height} L 0 ${height} Z`} fill="color-mix(in srgb, var(--leaf) 30%, var(--leaf-soft))" />
          </>
        )}
        {scene === 'route' && [0.18, 0.36, 0.54, 0.72, 0.9].map((f) => (
          // Faint contour lines, the way a walking map has them.
          <path key={f} d={`M -5 ${height * f} C 20 ${height * f - 30}, 45 ${height * f + 24}, 70 ${height * f - 10} S 95 ${height * f + 16}, 105 ${height * f}`} fill="none" stroke="var(--line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
        {scene !== 'route' && (
          <path d={`M 0 ${lakeTop + 18} C 20 ${lakeTop}, 40 ${lakeTop + 30}, 60 ${lakeTop + 12} S 90 ${lakeTop - 4}, 100 ${lakeTop + 14} L 100 ${height} L 0 ${height} Z`} fill="url(#map-water)" />
        )}
        {/* The trail: a pale road with a dashed line on it. */}
        <path d={d} fill="none" stroke="var(--surface)" strokeWidth="22" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.9" />
        <path d={d} fill="none" stroke={scene === 'route' ? 'var(--primary-soft)' : 'var(--line)'} strokeWidth="4" strokeLinecap="round" strokeDasharray="1 10" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* The sun is an element, not part of the stretched drawing, so it stays round. */}
      {scene !== 'route' && <span className={`map__sun map__sun--${scene}`} aria-hidden />}

      {nodes.map((n, i) => {
        const c = centre(i);
        const right = c.x > 50; // the trail leans right here, so company goes on the left (Tutu instead of scenery at the next lesson)
        return (
          <div key={n.id}>
            {scenery.length > 0 && n.state !== 'current' && <span className="map__scenery" style={{ left: `${right ? c.x - 31 : c.x + 31}%`, top: c.y - 14 }} aria-hidden>{scenery[i % scenery.length]}</span>}
            <div className={`map__node map__node--${n.state}`} style={{ left: `${c.x}%`, top: c.y }} role="listitem">
              <button type="button" className="map__circle" disabled={n.state === 'locked'} onClick={n.onClick} aria-label={n.title}>
                <span className="map__icon" aria-hidden>{n.icon}</span>
                {n.score !== undefined && <span className={`map__badge chip-score chip-score--${n.score >= 90 ? 'good' : n.score >= 75 ? 'okay' : 'weak'}`}>{n.score}</span>}
                {n.stars !== undefined && <span className="map__badge map__stars">{'★'.repeat(n.stars)}</span>}
                {n.mark === 'tick' && <span className="map__badge map__tick"><Icon name="check" size={14} /></span>}
                {n.mark === 'play' && <span className="map__badge map__go"><Icon name="play" size={12} /></span>}
              </button>
              <button type="button" className="map__label" disabled={n.state === 'locked'} onClick={n.onClick} tabIndex={-1}>
                <b>{n.title}</b>
                {n.sub && <small className="map__sub">{n.sub}</small>}
              </button>
            </div>
            {n.state === 'current' && (
              <span className="map__tutu" style={{ left: `${right ? c.x - 25 : c.x + 25}%`, top: c.y - tutuSize / 2 }} aria-hidden><Mascot mood="happy" size={tutuSize} /></span>
            )}
          </div>
        );
      })}

      <span className="map__flag" style={{ left: '50%', top: flagY }} aria-hidden>{unitIcon ?? '🏁'}<small>🏁</small></span>
      {scene !== 'route' && <span className="map__boat" style={{ top: lakeTop + 34 }} aria-hidden>{scene === 'meadow' ? '⛵' : '🛶'}</span>}
    </div>
  );
}
