import type { CSSProperties } from 'react';

const PATHS = {
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  home: 'M4 11.5 12 3.5l8 8M6.5 10v10.5h11V10',
  lab: 'M9.5 3.5h5M10.5 3.5v6L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3L13.5 9.5v-6M7.8 15h8.4',
  mic: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  chart: 'M4.5 20.5h15M7.5 16.5v-7M12 16.5v-13M16.5 16.5v-10',
  user: 'M12 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  back: 'M14.5 5.5 8 12l6.5 6.5',
  close: 'M6 6l12 12M18 6 6 18',
  share: 'M12 14.5V3.5M7.5 8 12 3.5 16.5 8M5.5 12.5v6.5h13v-6.5',
  camera: 'M4 7h3.2L9 3.5h6L16.8 7H20v13.5H4ZM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  image: 'M4.5 5.5h15v13h-15ZM4.5 15.5l4.2-4.2 3.3 3.3 2.4-2.4 5.1 5.1M15.6 9.6h.01',
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
  book: 'M12 6.5c-1.8-1.3-4.4-2-7.5-2v13c3.1 0 5.7.7 7.5 2 1.8-1.3 4.4-2 7.5-2v-13c-3.1 0-5.7.7-7.5 2ZM12 6.5v13',
  keyboard: 'M3.5 7h17v10h-17ZM7 10.5h.01M10.3 10.5h.01M13.7 10.5h.01M17 10.5h.01M8 14h8',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z',
  list: 'M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  map: 'M3.5 6.5 9 4.5l6 2 5.5-2v13L15 19.5l-6-2-5.5 2ZM9 4.5v13M15 6.5v13',
  cog: 'M19.15 10.08L21.26 10.37L21.26 13.63L19.15 13.92L18.41 15.70L19.70 17.39L17.39 19.70L15.70 18.41L13.92 19.15L13.63 21.26L10.37 21.26L10.08 19.15L8.30 18.41L6.61 19.70L4.30 17.39L5.59 15.70L4.85 13.92L2.74 13.63L2.74 10.37L4.85 10.08L5.59 8.30L4.30 6.61L6.61 4.30L8.30 5.59L10.08 4.85L10.37 2.74L13.63 2.74L13.92 4.85L15.70 5.59L17.39 4.30L19.70 6.61L18.41 8.30ZM15.1 12a3.1 3.1 0 1 0-6.2 0a3.1 3.1 0 1 0 6.2 0Z',
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={name === 'cog' ? 1.7 : 2} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
