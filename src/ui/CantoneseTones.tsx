import { useT } from '../i18n/useT';

/** Jyutping citation tones: schematic pitch levels, not a pronunciation-scoring model. */
export const CANTONESE_TONES = [
  { number: 1, syllable: 'si1', levels: [5, 5] },
  { number: 2, syllable: 'si2', levels: [2, 5] },
  { number: 3, syllable: 'si3', levels: [3, 3] },
  { number: 4, syllable: 'si4', levels: [2, 1] },
  { number: 5, syllable: 'si5', levels: [2, 3] },
  { number: 6, syllable: 'si6', levels: [2, 2] },
] as const;

export function CantoneseTones({ size = 190 }: { size?: number }) {
  const { tc } = useT();
  const label = tc('sound.yue:tones.name', 'Six Cantonese tones');
  return <figure className="tone" data-cantonese-tones style={{ width: size }}>
    <svg viewBox="0 0 210 126" width={size} height={size * .6} role="img" aria-label={label}>
      {CANTONESE_TONES.map(({ number, syllable, levels }, i) => <g key={number} transform={`translate(${i % 3 * 70} ${Math.floor(i / 3) * 63})`}>
        {[1, 2, 3, 4, 5].map(level => <line key={level} x1="10" x2="60" y1={8 + (5 - level) * 8} y2={8 + (5 - level) * 8} className="tone__grid" />)}
        <path d={`M 10 ${8 + (5 - levels[0]) * 8} L 60 ${8 + (5 - levels[1]) * 8}`} className="tone__target" />
        <text x="35" y="55" textAnchor="middle" fill="currentColor" fontSize="12" lang="yue-Latn">{syllable}</text>
      </g>)}
    </svg>
    <figcaption className="tone__key">{label}</figcaption>
  </figure>;
}
