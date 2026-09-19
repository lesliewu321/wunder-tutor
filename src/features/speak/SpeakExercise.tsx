import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgeBand, Assessment, Attempt, HomeLanguage, PhonemeId, SpeakItem } from '../../domain/types';
import { phonemeInfo } from '../../content/phonemes';
import { translationFor } from '../../content/translations';
import { isMastered, MAX_TRIES } from '../../engine/learning';
import type { SpeechErrorCode } from '../../speech';
import { playBlob, stopPlayback, voice } from '../../speech/voice';
import { useActiveProfile, useStore } from '../../state/store';
import { correctionFor, focusWordIndex, GOOD, headline, tier } from '../../tutor/feedback';
import { Icon } from '../../ui/Icon';
import { Button, ScoreRing, toast } from '../../ui/kit';
import { Mascot, type Mood } from '../../ui/Mascot';
import { MicButton } from '../../ui/MicButton';
import { ErrorPanel } from './ErrorPanel';
import { useSpeechTake } from './useSpeechTake';
import { WordSheet } from './WordSheet';

export interface SpeakResult {
  best: number;
  first: number;
  mastered: boolean;
  tries: number;
  /** The sound that gave the most trouble, if any — the lesson may add a drill for it. */
  troubleSound?: PhonemeId;
}

interface Props {
  item: SpeakItem;
  prompt?: 'text' | 'image' | 'translation';
  context: Attempt['context'];
  onDone: (r: SpeakResult) => void;
  continueLabel?: string;
  /** 'check' = one take per item (onboarding speaking check): feedback is shown but no retry is asked for. */
  mode?: 'practice' | 'check';
}

type View = 'ready' | 'result' | 'error';
type PlayKind = 'normal' | 'slow' | 'now' | 'before';
interface Take { assessment: Assessment; audio?: Blob }

/** LEARN → LISTEN → SPEAK → SCORE → CORRECT → RETRY → MASTER for a single word, phrase or sentence. */
export function SpeakExercise({ item, prompt = 'text', context, onDone, continueLabel = 'Continue', mode = 'practice' }: Props) {
  const profile = useActiveProfile();
  const demoMic = useStore((s) => s.settings.demoMic);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const finishItem = useStore((s) => s.finishItem);
  const setSettings = useStore((s) => s.setSettings);

  const [view, setView] = useState<View>('ready');
  const [takes, setTakes] = useState<Take[]>([]);
  const [error, setError] = useState<SpeechErrorCode | null>(null);
  const [playing, setPlaying] = useState<PlayKind | null>(null);
  const [sheetWord, setSheetWord] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(prompt === 'text');
  const micRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const band = profile.band;

  const current = takes[takes.length - 1];
  const previous = takes[takes.length - 2];
  const mastered = !!current && isMastered(current.assessment, band);
  const outOfTries = takes.length >= (mode === 'check' ? 1 : MAX_TRIES);
  const translation = prompt === 'translation' ? translationFor(item.id, profile.homeLanguage) : undefined;
  const effectivePrompt = prompt === 'translation' && !translation ? 'image' : prompt;

  const take = useSpeechTake({
    micRef,
    onError: (code) => { setError(code); setView('error'); },
    onAssessed: async (assessment, rec) => {
      const outcome = await recordAttempt({ item, assessment, audio: rec.blob, context, isRetry: takes.length > 0, previousScore: current?.assessment.overall });
      if (!alive.current) return;
      setTakes((t) => [...t, { assessment, audio: rec.blob }]);
      setRevealed(true);
      setView('result');
      if (outcome.personalBest) toast(`New personal best — ${outcome.personalBest.word}: ${outcome.personalBest.score}`, '🏅');
      outcome.soundsMastered.forEach((ph) => toast(`Sound mastered: ${phonemeInfo(ph).name}`, '👅'));
      outcome.achievements.filter((a) => !a.id.startsWith('sound-')).forEach((a) => toast(a.title, a.icon));
    },
  });

  const play = useCallback(async (kind: PlayKind) => {
    stopPlayback();
    setPlaying(kind);
    try {
      if (kind === 'normal' || kind === 'slow') {
        if (!voice.available()) throw new Error('playback-unavailable');
        await voice.speak(item.say ?? item.text, { accent: profile.accent, slow: kind === 'slow', kind: item.kind });
      } else {
        const blob = (kind === 'now' ? current : previous)?.audio;
        if (!blob) { toast(demoMic ? 'The demo microphone doesn’t record sound' : 'No recording for this try', '🎧'); return; }
        await playBlob(blob);
      }
    } catch {
      toast('Sound isn’t working on this device right now', '🔇');
    } finally {
      if (alive.current) setPlaying((p) => (p === kind ? null : p));
    }
  }, [item, profile.accent, current, previous, demoMic]);

  // Learn → Listen: the model pronunciation plays as soon as a new item appears (not for "say what you see").
  useEffect(() => {
    alive.current = true;
    const t = window.setTimeout(() => { if (prompt === 'text') void play('normal'); }, 450);
    return () => { alive.current = false; clearTimeout(t); stopPlayback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Young children can't read a correction — Pip says it out loud. Older learners can tap to hear it.
  const sayTip = useCallback((text: string) => {
    stopPlayback();
    void voice.speak(text, { accent: profile.accent }).catch(() => undefined);
  }, [profile.accent]);
  const tipToSay = current && view === 'result' && band === 'little' ? spokenTip(current.assessment, band, profile.homeLanguage) : null;
  useEffect(() => {
    if (!tipToSay) return;
    const t = window.setTimeout(() => sayTip(tipToSay), 1100);
    return () => clearTimeout(t);
  }, [tipToSay, takes.length, sayTip]);

  const startListening = () => {
    setError(null);
    setSheetWord(null);
    setView('ready');
    void take.start(item, takes.length);
  };
  const onMic = () => (take.phase === 'listening' ? void take.stop() : startListening());

  const finish = () => {
    const best = Math.max(...takes.map((t) => t.assessment.overall));
    const everMastered = takes.some((t) => isMastered(t.assessment, band));
    // The onboarding check only seeds the pronunciation profile; it doesn't count as studying the item.
    if (mode !== 'check') finishItem(item, best, everMastered, takes.length);
    const first = takes[0].assessment;
    const fi = focusWordIndex(first);
    const c = fi >= 0 ? correctionFor(first.words[fi], band, profile.homeLanguage) : null;
    onDone({ best, first: first.overall, mastered: everMastered, tries: takes.length, troubleSound: takes.length > 1 || !everMastered ? c?.phoneme : undefined });
  };

  const busy = take.phase !== 'idle';
  const phase: View | 'listening' | 'processing' = take.phase === 'idle' ? view : take.phase;
  const focusIdx = current ? focusWordIndex(current.assessment) : -1;
  const focus = current && focusIdx >= 0 ? correctionFor(current.assessment.words[focusIdx], band, profile.homeLanguage) : null;
  const single = !!current && current.assessment.words.length === 1;
  const focusPhonemeScore = current && focusIdx >= 0 ? Math.min(...current.assessment.words[focusIdx].phonemes.map((ph) => ph.score), 100) : undefined;
  const fixed = current && previous ? soundFixed(previous.assessment, current.assessment, band) : null;
  // Worth another go: a clearly weak word, or anything short of mastery. An 81 inside an 89 sentence is not.
  const fixable = !!focus && focus.kind !== 'fine' && (focus.score < 80 || !mastered);
  const delta = current && previous ? current.assessment.overall - previous.assessment.overall : undefined;
  const veryLow = !!current && current.assessment.overall < 40;

  const mood: Mood =
    phase === 'listening' ? 'listening' : phase === 'processing' ? 'thinking' : phase === 'error' ? 'encourage'
      : phase === 'result' ? (mastered ? (current!.assessment.overall >= 90 ? 'cheer' : 'happy') : 'encourage')
        : playing === 'normal' || playing === 'slow' ? 'talking' : 'idle';

  const status =
    phase === 'listening' ? 'I’m listening… tap when you’re done'
      : phase === 'processing' ? (take.slowHint ? 'Still checking… almost there' : 'Checking your pronunciation…')
        : takes.length ? 'Tap the mic and try again'
          : effectivePrompt === 'text' ? 'Listen, then tap the mic and say it' : 'Tap the mic and say it in English';

  return (
    <div className={`speak speak--${phase}`}>
      <div className="speak__stage">
        <div className={`prompt prompt--${item.kind}`}>
          {item.picture && <div className="prompt__pic" aria-hidden>{item.picture}</div>}
          {!revealed && effectivePrompt === 'translation' ? (
            <><div className="prompt__hint">Say it in English</div><p className="prompt__translation" lang={profile.homeLanguage}>{translation}</p></>
          ) : !revealed ? (
            <p className="prompt__hint prompt__hint--big">What is it? Say it!</p>
          ) : (
            <p className="prompt__text">
              {current && phase === 'result'
                ? current.assessment.words.map((w, i) => (
                  <button key={i} type="button" className={`word word--${w.errorType === 'omission' ? 'missing' : tier(w.score)} ${i === focusIdx ? 'word--focus' : ''}`}
                    onClick={() => setSheetWord(i)} aria-label={`${w.word}, score ${w.score}. Tap for help`}>
                    {displayWord(item.text, i, w.word)}
                  </button>
                ))
                : item.text}
            </p>
          )}
          {revealed && item.meaning && band !== 'little' && phase !== 'result' && <p className="prompt__meaning">{item.meaning}</p>}

          {phase !== 'result' && (
            <div className="listen-row">
              {revealed ? (
                <>
                  <button type="button" className={`pill ${playing === 'normal' ? 'is-playing' : ''}`} onClick={() => void play('normal')} disabled={busy}><Icon name="speaker" size={20} />Listen</button>
                  <button type="button" className={`pill ${playing === 'slow' ? 'is-playing' : ''}`} onClick={() => void play('slow')} disabled={busy}><Icon name="turtle" size={20} />Slow</button>
                </>
              ) : (
                <button type="button" className="pill" onClick={() => { setRevealed(true); void play('normal'); }} disabled={busy}><Icon name="ear" size={20} />I need a hint</button>
              )}
            </div>
          )}
        </div>

        {phase === 'result' && current && (
          <div className="result" aria-live="polite">
            <div className="result__top">
              <ScoreRing key={takes.length} score={current.assessment.overall} size={band === 'little' ? 132 : 120} stars={band === 'little'} />
              <div className="result__summary">
                <h2 className="result__headline">{headline(current.assessment.overall, band, delta, fixable)}</h2>
                {previous ? (
                  <div className={`delta ${delta! > 0 ? 'delta--up' : delta! < 0 ? 'delta--down' : ''}`}>
                    <span>Before <b>{previous.assessment.overall}</b></span><Icon name="chevron" size={16} /><span>Now <b>{current.assessment.overall}</b></span>
                    <em>{delta! > 0 ? `+${delta}` : delta}</em>
                  </div>
                ) : (
                  <p className="result__sub">{focus && focus.kind !== 'fine' ? (band === 'little' ? 'Listen to Pip’s tip!' : 'Tap the coloured word to see how to fix it.') : 'Every word was clear.'}</p>
                )}
              </div>
            </div>

            {focus && focus.kind !== 'fine' ? (
              <button type="button" className={`fix fix--${tier(focus.score)}`} onClick={() => setSheetWord(focusIdx)}>
                <div className="fix__head">
                  {/* One word on screen → name the sound instead of repeating the word with a second, different number. */}
                  <span className="fix__word">{single && focus.phoneme ? <>The “{phonemeInfo(focus.phoneme).label}” sound</> : focus.word}</span>
                  <span className="fix__score">{focus.kind === 'omission' ? 'missed' : single && focus.phoneme ? focusPhonemeScore : focus.score}</span>
                </div>
                <p className="fix__problem">{focus.problem}</p>
                <p className="fix__tip"><b>Try:</b> {focus.tip}</p>
                <span className="fix__more">Show me how <Icon name="chevron" size={16} /></span>
              </button>
            ) : (
              <div className="fix fix--good fix--static">
                {fixed ? (
                  <>
                    <div className="fix__head"><span className="fix__word">The “{phonemeInfo(fixed.phoneme).label}” sound</span><span className="fix__score fix__score--good">{fixed.before} → {fixed.now}</span></div>
                    <p className="fix__problem">You fixed it! Every word is clear now.</p>
                  </>
                ) : <p className="fix__problem">Clear and confident — nothing to fix here.</p>}
              </div>
            )}

            <div className="compare" role="group" aria-label="Listen and compare">
              <button type="button" className={`pill pill--sm ${playing === 'normal' ? 'is-playing' : ''}`} onClick={() => void play('normal')}><Icon name="speaker" size={18} />Teacher</button>
              <button type="button" className={`pill pill--sm ${veryLow ? 'pill--pulse' : ''} ${playing === 'slow' ? 'is-playing' : ''}`} onClick={() => void play('slow')}><Icon name="turtle" size={18} />Slow</button>
              {previous && <button type="button" className={`pill pill--sm ${playing === 'before' ? 'is-playing' : ''}`} onClick={() => void play('before')}><Icon name="play" size={14} />Before</button>}
              <button type="button" className={`pill pill--sm ${playing === 'now' ? 'is-playing' : ''}`} onClick={() => void play('now')}><Icon name="play" size={14} />{previous ? 'Now' : 'Me'}</button>
            </div>
          </div>
        )}

        {phase === 'error' && error && (
          <ErrorPanel code={error} onRetry={startListening}
            onUseDemo={() => { setSettings({ demoMic: true }); setError(null); setView(takes.length ? 'result' : 'ready'); toast('Demo microphone on — scores are simulated', '🎛️'); }} />
        )}
      </div>

      <div className="speak__dock">
        {phase !== 'result' && phase !== 'error' && (
          <>
            <div className="speak__coach">
              <Mascot mood={mood} size={band === 'teen' ? 64 : 84} />
              <p className="speak__status" aria-live="polite">{status}</p>
            </div>
            <MicButton ref={micRef} state={phase === 'ready' ? 'ready' : phase} onPress={onMic} size={band === 'little' ? 116 : 104} />
          </>
        )}
        {phase === 'result' && current && (
          <div className="speak__actions">
            {!mastered && outOfTries && <p className="speak__kind">{mode === 'check' ? 'Good to know — Pip will help you with this.' : 'Good effort! We’ll practise this one again later.'}</p>}
            {outOfTries || (mastered && !fixable) ? (
              <>
                <Button variant="leaf" size="lg" block onClick={finish}>{continueLabel}</Button>
                {!outOfTries && current.assessment.overall < 95 && <Button variant="ghost" icon="retry" block onClick={startListening}>Try for a higher score</Button>}
              </>
            ) : (
              <>
                {/* A concrete fix is on screen → retrying is the main action, even if the score already passes. */}
                <Button variant="coral" size="lg" icon="mic" block onClick={startListening}>{mastered ? 'Try the fix' : 'Try again'}</Button>
                {mastered ? <Button variant="ghost" block onClick={finish}>{continueLabel}</Button> : takes.length >= 2 && <Button variant="ghost" block onClick={finish}>Skip for now</Button>}
              </>
            )}
          </div>
        )}
      </div>

      {current && sheetWord != null && phase === 'result' && (
        <WordSheet
          word={current.assessment.words[sheetWord]} band={band} home={profile.homeLanguage} onClose={() => setSheetWord(null)}
          onListen={(slow) => void voice.speak(current.assessment.words[sheetWord].word, { accent: profile.accent, slow }).catch(() => toast('Sound isn’t working on this device right now', '🔇'))}
          onHearMe={() => void play('now')}
          onHearTip={sayTip}
          onRetry={outOfTries ? undefined : startListening}
        />
      )}
    </div>
  );
}

const spokenTip = (a: Assessment, band: AgeBand, home?: HomeLanguage): string | null => {
  const i = focusWordIndex(a);
  if (i < 0) return a.overall >= GOOD ? 'Great job!' : null;
  const c = correctionFor(a.words[i], band, home);
  return c.kind === 'fine' ? 'Great job!' : c.tip;
};

/** The sound the last correction targeted, if this take improved it — so the learner sees exactly what got better. */
const soundFixed = (before: Assessment, now: Assessment, band: AgeBand): { phoneme: PhonemeId; before: number; now: number } | null => {
  const i = focusWordIndex(before);
  if (i < 0) return null;
  const c = correctionFor(before.words[i], band);
  if (!c.phoneme) return null;
  const was = Math.min(...before.words[i].phonemes.filter((p) => p.phoneme === c.phoneme).map((p) => p.score));
  const scores = (now.words[i]?.phonemes ?? []).filter((p) => p.phoneme === c.phoneme).map((p) => p.score);
  if (!scores.length) return null;
  const is = Math.min(...scores);
  return is - was >= 5 ? { phoneme: c.phoneme, before: was, now: is } : null;
};

/** Show the word as written in the prompt (capitals, punctuation) rather than the provider's normalised token. */
const displayWord = (text: string, index: number, fallback: string): string => text.split(/\s+/)[index] ?? fallback;
