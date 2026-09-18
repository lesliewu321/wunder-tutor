import { useEffect, useRef, useState } from 'react';
import { Mic, Play, RotateCcw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Stage = 'first' | 'listening' | 'second';

const TAKES = {
  first: { score: 68, tone: 'okay', headline: 'Nearly there — one thing to fix.', th: 41 },
  second: { score: 86, tone: 'good', headline: 'Up 18 points — you fixed it!', th: 93 },
} as const;

const TONE = {
  okay: { ring: '#f0a020', text: 'text-okay', chip: 'bg-[#fff0d4] text-okay border-okay' },
  good: { ring: '#27b56a', text: 'text-good', chip: 'text-good' },
} as const;

/**
 * A scripted walk through the core loop (speak → score → fix → retry → improve), styled like the app.
 * It is a demo with fixed numbers — labelled as such on the page — not the real scorer.
 */
export default function PhoneDemo() {
  const [stage, setStage] = useState<Stage>('first');
  const [shown, setShown] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const take = stage === 'second' ? TAKES.second : TAKES.first;
  const tone = TONE[take.tone];

  // Count the score up whenever a take lands.
  useEffect(() => {
    if (stage === 'listening') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(take.score); return; }
    const from = stage === 'second' ? TAKES.first.score : 0;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(Math.round(from + (take.score - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage, take.score]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const retry = () => {
    setStage('listening');
    timer.current = window.setTimeout(() => setStage('second'), 1700);
  };

  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative mx-auto w-[310px] select-none">
      <div className="absolute -inset-6 -z-10 rounded-[3.5rem] bg-gradient-to-br from-primary/25 via-coral/15 to-sun/25 blur-2xl" aria-hidden />
      <div className="rounded-[2.6rem] border-[10px] border-foreground bg-background p-4 pb-5 shadow-2xl" role="group" aria-label="Interactive demo of a Wunder Tutor speaking exercise">
        <div className="mx-auto mb-3 h-1.5 w-20 rounded-full bg-border" aria-hidden />

        {/* prompt */}
        <div className="rounded-3xl bg-card p-4 text-center shadow-sm">
          <div className="text-3xl" aria-hidden>3️⃣</div>
          <p className={cn('font-display text-4xl font-extrabold transition-colors duration-500', stage === 'listening' ? 'text-foreground' : tone.text)}>
            <span className={cn('rounded-xl px-2', stage === 'first' && 'border-b-4 bg-[#fff0d4]', stage === 'first' && 'border-okay')}>three</span>
          </p>
        </div>

        {stage === 'listening' ? (
          <div className="flex h-[252px] flex-col items-center justify-center gap-4" aria-live="polite">
            <p className="rounded-2xl rounded-bl-sm bg-card px-4 py-2 text-sm font-extrabold shadow-sm">I’m listening…</p>
            <div className="relative grid size-24 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-weak/30" />
              <span className="relative grid size-24 place-items-center rounded-full bg-weak text-white shadow-[0_6px_0_#a8202f]">
                <span className="flex h-9 items-center gap-1" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => <i key={i} className="w-1.5 animate-pulse rounded-full bg-white" style={{ height: `${14 + ((i * 7) % 18)}px`, animationDelay: `${i * 110}ms` }} />)}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3" aria-live="polite">
            {/* score */}
            <div className="flex items-center gap-3">
              <div className="relative size-[92px] shrink-0">
                <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                  <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="11" />
                  <circle cx="60" cy="60" r={r} fill="none" stroke={tone.ring} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} style={{ transition: 'stroke .3s' }} />
                </svg>
                <span className="absolute inset-0 grid place-items-center font-display text-3xl font-extrabold">{shown}</span>
              </div>
              <div className="min-w-0">
                <p className="font-display text-[1.05rem] font-extrabold leading-tight">{take.headline}</p>
                {stage === 'second' && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap text-xs font-bold text-muted-foreground">
                    <span>Before <b className="text-foreground">68</b></span><span aria-hidden>→</span><span>Now <b className="text-foreground">86</b></span>
                    <span className="rounded-full bg-leaf-soft px-2 py-0.5 font-display text-sm font-extrabold text-good">+18</span>
                  </p>
                )}
              </div>
            </div>

            {/* the fix */}
            <div className={cn('rounded-2xl border-l-[6px] bg-card p-3 shadow-sm', stage === 'first' ? 'border-okay' : 'border-leaf')}>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-extrabold">The “th” sound</span>
                <span className={cn('font-display text-base font-extrabold', stage === 'first' ? 'text-weak' : 'text-good')}>{stage === 'first' ? take.th : `41 → ${take.th}`}</span>
              </div>
              {stage === 'first' ? (
                <>
                  <p className="text-sm font-extrabold">Your “th” sounded closer to “t”.</p>
                  <p className="mt-0.5 text-[0.82rem] leading-snug text-muted-foreground"><b className="text-primary">Try:</b> Put the tip of your tongue lightly between your teeth and blow air over it.</p>
                </>
              ) : (
                <p className="text-sm font-extrabold">You fixed it! Every sound is clear now.</p>
              )}
            </div>

            {/* compare */}
            <div className="grid grid-flow-col gap-1.5 text-[0.72rem] font-extrabold text-primary" aria-hidden>
              <span className="flex h-8 items-center justify-center gap-1 rounded-full border-2 border-border bg-card"><Volume2 className="size-3.5" />Teacher</span>
              {stage === 'second' && <span className="flex h-8 items-center justify-center gap-1 rounded-full border-2 border-border bg-card"><Play className="size-3" />Before</span>}
              <span className="flex h-8 items-center justify-center gap-1 rounded-full border-2 border-border bg-card"><Play className="size-3" />{stage === 'second' ? 'Now' : 'Me'}</span>
            </div>
          </div>
        )}

        <div className="mt-3">
          {stage === 'first' && <Button variant="coral" size="xl" className="w-full" onClick={retry}><Mic />Try again</Button>}
          {stage === 'listening' && <Button variant="coral" size="xl" className="w-full" disabled>Listening…</Button>}
          {stage === 'second' && <Button variant="soft" size="xl" className="w-full" onClick={() => setStage('first')}><RotateCcw />Replay the demo</Button>}
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-bold text-muted-foreground">Interactive demo with example numbers — tap “Try again”.</p>
    </div>
  );
}
