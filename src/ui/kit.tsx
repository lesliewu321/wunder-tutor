import { t } from '../i18n';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { tier } from '../tutor/feedback';

type Variant = 'primary' | 'coral' | 'leaf' | 'soft' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon, block, className = '', children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={`btn btn--${variant} btn--${size} ${block ? 'btn--block' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 22} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, className = '', ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'leaf' | 'sun' }) {
  return (
    <div className={`bar bar--${tone}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar__fill" style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, value))})` }} />
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Bottom sheet (a centred dialog on tablets). Focus moves into it and stays there; Escape, the scrim and × close it. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose on every render; focus must only move when the sheet opens or closes.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close.current(); return; }
      const box = ref.current;
      if (e.key !== 'Tab' || !box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], at = document.activeElement;
      if (!box.contains(at)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (at === first || at === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="sheet__top">
          <div className="sheet__grip" />
          <button type="button" className="sheet__close" aria-label={t('common.close')} onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.getElementById('app-frame') ?? document.body,
  );
}

const useCountUp = (target: number, ms = 900): number => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
};

/** The one number the learner sees first. Stars replace the number for the youngest band. */
export function ScoreRing({ score, size = 148, stars }: { score: number; size?: number; stars?: boolean }) {
  const shown = useCountUp(score);
  const r = 52, c = 2 * Math.PI * r;
  const grade = tier(score);
  const starCount = score >= 85 ? 3 : score >= 65 ? 2 : 1;
  return (
    <div className={`ring ring--${grade}`} style={{ width: size, height: size }} role="img" aria-label={t('common.score.aria', { score })}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} className="ring__track" />
        <circle cx="60" cy="60" r={r} className="ring__value" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring__label">
        {stars ? (
          <div className="ring__stars" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={i < starCount ? 'on' : ''} style={{ animationDelay: `${300 + i * 160}ms` }}>★</span>)}</div>
        ) : null}
        <div className="ring__num">{shown}</div>
        {!stars && <div className="ring__of">{t('common.score.outOf')}</div>}
      </div>
    </div>
  );
}

export function Confetti({ count = 36 }: { count?: number }) {
  const colors = ['var(--coral)', 'var(--sun)', 'var(--leaf)', 'var(--sky)', 'var(--primary)'];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`, background: colors[i % colors.length],
          animationDelay: `${(i % 9) * 70}ms`, animationDuration: `${1500 + ((i * 53) % 900)}ms`,
          transform: `rotate(${(i * 47) % 360}deg)`, borderRadius: i % 3 === 0 ? '50%' : '3px',
        }} />
      ))}
    </div>
  );
}

// ---------- Toasts ----------
interface ToastMsg { id: number; text: string; icon?: string }
let pushToast: ((t: Omit<ToastMsg, 'id'>) => void) | null = null;
export const toast = (text: string, icon?: string) => pushToast?.({ text, icon });

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((xs) => {
        // The same sentence twice over is noise, and reads as something going wrong twice: a lesson plays its word
        // by itself and the learner also presses Listen, so one silent word used to stack two identical messages.
        if (xs.some((x) => x.text === t.text)) return xs;
        return [...xs.slice(-2), { ...t, id }];
      });
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3400);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className="toast">{t.icon && <span className="toast__icon">{t.icon}</span>}{t.text}</div>)}
    </div>
  );
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? <IconButton icon="back" label={t('common.back')} onClick={onBack} /> : <span className="topbar__spacer" />}
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__right">{right ?? <span className="topbar__spacer" />}</div>
    </header>
  );
}
