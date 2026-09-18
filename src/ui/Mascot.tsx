export type Mood = 'idle' | 'listening' | 'thinking' | 'happy' | 'cheer' | 'encourage' | 'talking';

/** Pip — Wunder Tutor's guide. Big ears because Pip is, above all, a very good listener. */
export function Mascot({ mood = 'idle', size = 120, className = '' }: { mood?: Mood; size?: number; className?: string }) {
  const joyful = mood === 'happy' || mood === 'cheer';
  const pupil = mood === 'thinking' ? { dx: -2.5, dy: -3 } : mood === 'listening' ? { dx: 0, dy: -1 } : { dx: 0, dy: 0 };
  const ear = (
    <g>
      <path d="M33 54 C20 32 23 9 36 7 C49 9 53 30 51 47 Z" fill="var(--primary)" />
      <path d="M36 46 C29 32 30 17 36.5 15 C43 17 45 31 44 42 Z" fill="#ff9bb0" />
    </g>
  );
  return (
    <svg className={`mascot mascot--${mood} ${className}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Pip the tutor">
      <ellipse className="mascot__shadow" cx="60" cy="112" rx="28" ry="4.5" fill="rgba(43,33,64,.14)" />
      <g className="mascot__body">
        <g className="mascot__ear">{ear}</g>
        <g transform="translate(120 0) scale(-1 1)"><g className="mascot__ear">{ear}</g></g>
        {mood === 'listening' && (
          <g className="mascot__waves" fill="none" stroke="var(--coral)" strokeWidth="3" strokeLinecap="round">
            <path d="M12 22 Q6 32 12 42" /><path d="M108 22 Q114 32 108 42" />
          </g>
        )}
        <ellipse cx="48" cy="107" rx="9.5" ry="5" fill="var(--primary-deep)" />
        <ellipse cx="72" cy="107" rx="9.5" ry="5" fill="var(--primary-deep)" />
        {mood === 'cheer' ? (
          <g fill="var(--primary)">
            <ellipse cx="22" cy="56" rx="6" ry="11" transform="rotate(-28 22 56)" />
            <ellipse cx="98" cy="56" rx="6" ry="11" transform="rotate(28 98 56)" />
          </g>
        ) : (
          <g fill="var(--primary)">
            <ellipse cx="25" cy="84" rx="6" ry="10" transform="rotate(16 25 84)" />
            <ellipse cx="95" cy="84" rx="6" ry="10" transform="rotate(-16 95 84)" />
          </g>
        )}
        <ellipse cx="60" cy="74" rx="36" ry="34" fill="var(--primary)" />
        <ellipse cx="60" cy="86" rx="22" ry="17" fill="#fff" opacity=".92" />
        <circle cx="35" cy="79" r="5" fill="var(--coral)" opacity=".55" />
        <circle cx="85" cy="79" r="5" fill="var(--coral)" opacity=".55" />

        {joyful ? (
          <g fill="none" stroke="#2b2140" strokeWidth="3.6" strokeLinecap="round">
            <path d="M39.5 67 Q47 58 54.5 67" /><path d="M65.5 67 Q73 58 80.5 67" />
          </g>
        ) : (
          <g className="mascot__eyes">
            <circle cx="47" cy="65" r="9.5" fill="#fff" /><circle cx="73" cy="65" r="9.5" fill="#fff" />
            <circle cx={47 + pupil.dx} cy={66 + pupil.dy} r="4.8" fill="#2b2140" /><circle cx={73 + pupil.dx} cy={66 + pupil.dy} r="4.8" fill="#2b2140" />
            <circle cx={48.8 + pupil.dx} cy={64 + pupil.dy} r="1.6" fill="#fff" /><circle cx={74.8 + pupil.dx} cy={64 + pupil.dy} r="1.6" fill="#fff" />
            {mood === 'encourage' && (
              <g stroke="#2b2140" strokeWidth="2.6" strokeLinecap="round"><path d="M39 53 L53 50.5" /><path d="M81 53 L67 50.5" /></g>
            )}
          </g>
        )}

        {joyful && (
          <g><path d="M50 78 Q60 95 70 78 Z" fill="#5a1e33" /><path d="M55 85.5 Q60 90.5 65 85.5 Q60 82.5 55 85.5Z" fill="#ff8fa3" /></g>
        )}
        {mood === 'idle' && <path d="M52 80 Q60 87.5 68 80" fill="none" stroke="#2b2140" strokeWidth="3" strokeLinecap="round" />}
        {mood === 'encourage' && <path d="M53 81 Q60 86 67 81" fill="none" stroke="#2b2140" strokeWidth="3" strokeLinecap="round" />}
        {mood === 'listening' && <ellipse cx="60" cy="83" rx="3.6" ry="4.2" fill="#5a1e33" />}
        {mood === 'thinking' && <path d="M54 83 H66" stroke="#2b2140" strokeWidth="3" strokeLinecap="round" />}
        {mood === 'talking' && <ellipse className="mascot__talk" cx="60" cy="83" rx="6" ry="5" fill="#5a1e33" />}
      </g>
      {mood === 'thinking' && (
        <g className="mascot__dots" fill="var(--ink-faint)"><circle cx="94" cy="30" r="3" /><circle cx="102" cy="21" r="4" /><circle cx="112" cy="10" r="5" /></g>
      )}
    </svg>
  );
}
