import type { CSSProperties } from 'react';

const PATHS = {
  home: 'M4 11.5 12 4l8 7.5M6.5 10v9h11v-9',
  lab: 'M9.5 3.5h5M10.5 3.5v6L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3L13.5 9.5v-6M7.8 15h8.4',
  mic: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  chart: 'M4.5 19.5h15M7.5 16v-4M12 16V7M16.5 16v-6.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  back: 'M14.5 5.5 8 12l6.5 6.5',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10.5-6.5L8 5.5Z',
  stop: 'M7 7h10v10H7z',
  speaker: 'M4.5 9.5v5h3.2l4.8 4v-13l-4.8 4H4.5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  retry: 'M19 12a7 7 0 1 1-2.2-5.1M19 4.5v4h-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M7 10.5V8a5 5 0 0 1 10 0v2.5M6 10.5h12v9H6z',
  chevron: 'M9.5 5.5 16 12l-6.5 6.5',
  flame: 'M12 3.5c.6 3.2 4.8 5 4.8 9.6a4.8 4.8 0 0 1-9.6 0c0-1.8.8-3 1.7-4 .3 1.4 1 2.2 1.9 2.4-.5-3 .2-6 1.2-8Z',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.8Z',
  ear: 'M7 10a5.5 5.5 0 0 1 11 0c0 3.5-3 4-3 7a3 3 0 0 1-5.6 1.4M10 11a2.5 2.5 0 0 1 5 0',
  shield: 'M12 3.5 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6l-7-2.5ZM9 12l2.2 2.2L15.2 10',
  trash: 'M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7M10.5 10.5v6M13.5 10.5v6',
  plus: 'M12 5v14M5 12h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.8v.4',
  bolt: 'M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z',
  chat: 'M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5a2 2 0 0 1-2-2v-8Z',
  wifi: 'M3.5 9.5a12.5 12.5 0 0 1 17 0M6.5 13a8 8 0 0 1 11 0M9.5 16.3a3.6 3.6 0 0 1 5 0M12 19.5v.01',
} as const;

export type IconName = keyof typeof PATHS | 'turtle';

export function Icon({ name, size = 24, fill, style }: { name: IconName; size?: number; fill?: boolean; style?: CSSProperties }) {
  if (name === 'turtle') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <path d="M4 15.5c0-4.4 3.1-8 7.5-8s7 3.6 7 8H4Z" />
        <path d="M18 12.2c1.2-1.6 3-1.4 3.3-.2.3 1.3-.9 2.2-2.6 2.3M7 15.5V18M15.5 15.5V18M9 7.9l1 3.6h4l1-3.4" />
      </svg>
    );
  }
  const filled = fill || name === 'play' || name === 'stop';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
