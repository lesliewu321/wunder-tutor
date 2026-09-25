import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from '../../i18n';
import { KoText } from '../../ui/KoText';
import { isGrownUp, type AgeBand, type Assessment, type Attempt, type HomeLanguage, type PhonemeId, type SpeakItem } from '../../domain/types';
import { phonemeInfo } from '../../content/phonemes';
import { translationFor } from '../../content/translations';
import { isMastered, MAX_TRIES } from '../../engine/learning';
import { badgeName } from '../../engine/rewards';
import type { SpeechErrorCode } from '../../speech';
import { voiceStats } from '../../speech/pitch';
import { noSoundMessage } from '../../speech/health';
import { localeOf, playBlob, stopPlayback, voice } from '../../speech/voice';
import { markSyllable } from '../../content/zh/pinyin';
import { hanChars } from '../../content/zh/script';
import { inEnglish, t, tm } from '../../i18n';
import { rich, useT } from '../../i18n/useT';
import { useActiveProfile, useStore } from '../../state/store';
import { correctionFor, focusWordIndex, GOOD, headline, soundToDrill, tier, writtenWords } from '../../tutor/feedback';
import { Icon } from '../../ui/Icon';
import { Button, ScoreRing, toast } from '../../ui/kit';
import { Mascot, type Mood } from '../../ui/Mascot';
import { MicButton } from '../../ui/MicButton';
import { ToneContour } from '../../ui/ToneContour';
import { beatScores, JaBeats, JaText } from '../../ui/JaText';
import { ZhText } from '../../ui/ZhText';
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
  /** 'free' = any text (Say it right): full feedback and retries, but not added to the review schedule. */
  /** 'test' = the lesson without the teacher: nothing to listen to, no tips, one go per item; only the score is shown. */
  mode?: 'practice' | 'check' | 'free' | 'test';
}

type View = 'ready' | 'result' | 'error';
type PlayKind = 'normal' | 'slow' | 'now' | 'before';
interface Take { assessment: Assessment; audio?: Blob }

/** LEARN → LISTEN → SPEAK → SCORE → CORRECT → RETRY → MASTER for a single word, phrase or sentence. */
export function SpeakExercise({ item, prompt = 'text', context, onDone, continueLabel, mode = 'practice' }: Props) {
  const { t } = useT();
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
  const test = mode === 'test';
  const outOfTries = takes.length >= (mode === 'check' || test ? 1 : MAX_TRIES);
  const translation = prompt === 'translation' ? translationFor(item.id, profile.homeLanguage) : undefined;
  const effectivePrompt = prompt === 'translation' && !translation ? 'image' : prompt;

  const take = useSpeechTake({
    micRef,
    onError: (code) => { setError(code); setView('error'); },
    onAssessed: async (assessment, rec) => {
      const outcome = await recordAttempt({ item, assessment, audio: rec.blob, context, isRetry: takes.length > 0, previousScore: current?.assessment.overall, voice: voiceStats(rec.pitch) });
      if (!alive.current) return;
      setTakes((prev) => [...prev, { assessment, audio: rec.blob }]);
      setRevealed(true);
      setView('result');
      if (outcome.personalBest) toast(t('speak.toast.best', { word: outcome.personalBest.word, score: outcome.personalBest.score }), '🏅');
      outcome.soundsMastered.forEach((ph) => toast(t('speak.toast.soundMastered', { name: phonemeInfo(ph).name }), '👅'));
      outcome.achievements.filter((a) => !a.id.startsWith('sound-')).forEach((a) => toast(badgeName(a), a.icon));
    },
  });

  const play = useCallback(async (kind: PlayKind) => {
    stopPlayback();
    setPlaying(kind);
    try {
      if (kind === 'normal' || kind === 'slow') {
        // No available() check first: speak() reads the server's answer afresh, and says why when nothing can play.
        await voice.speak(item.say ?? item.text, { accent: localeOf(item, profile.accent), slow: kind === 'slow', kind: item.kind, ephemeral: mode === 'free' || undefined });
      } else {
        const blob = (kind === 'now' ? current : previous)?.audio;
        if (!blob) { toast(t(demoMic ? 'speak.toast.demoSilent' : 'speak.toast.noRecording'), '🎧'); return; }
        await playBlob(blob);
      }
    } catch (e) {
      void noSoundMessage(profile.band, e).then((m) => toast(m, '🔇'));
    } finally {
      if (alive.current) setPlaying((p) => (p === kind ? null : p));
    }
  }, [item, profile.accent, current, previous, demoMic]);

  // Learn → Listen: the model pronunciation plays as soon as a new item appears (not for "say what you see").
  useEffect(() => {
    alive.current = true;
    const timer = window.setTimeout(() => { if (prompt === 'text' && !test) void play('normal'); }, 450);
    return () => { alive.current = false; clearTimeout(timer); stopPlayback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Young children can't read a correction — Tutu says it out loud. Older learners can tap to hear it.
  const sayTip = useCallback((text: string) => {
    stopPlayback();
    void voice.speak(text, { accent: profile.accent }).catch(() => undefined);
  }, [profile.accent]);
  // Said aloud, so in English whatever the App language (see inEnglish).
  const tipToSay = current && view === 'result' && band === 'little' && !test ? inEnglish(() => spokenTip(current.assessment, band, profile.homeLanguage)) : null;
  useEffect(() => {
    if (!tipToSay) return;
    const timer = window.setTimeout(() => sayTip(tipToSay), 1100);
    return () => clearTimeout(timer);
  }, [tipToSay, takes.length, sayTip]);

  const startListening = () => {
    setError(null);
    setSheetWord(null);
    setView('ready');
    void take.start(item, takes.length);
  };
  const onMic = () => (take.phase === 'listening' ? void take.stop() : startListening());

  const finish = () => {
    const best = Math.max(...takes.map((tk) => tk.assessment.overall));
    const everMastered = takes.some((tk) => isMastered(tk.assessment, band));
    // The onboarding check only seeds the pronunciation profile; it doesn't count as studying the item.
    if (mode === 'practice') finishItem(item, best, everMastered, takes.length);
    const first = takes[0].assessment;
    onDone({ best, first: first.overall, mastered: everMastered, tries: takes.length, troubleSound: soundToDrill(takes.map((tk) => tk.assessment), band, profile.homeLanguage) });
  };

  const busy = take.phase !== 'idle';
  const phase: View | 'listening' | 'processing' = take.phase === 'idle' ? view : take.phase;
  const focusIdx = current ? focusWordIndex(current.assessment) : -1;
  const shown = current && !item.zh ? writtenWords(item.text, current.assessment.words) : [];
  const focus = current && focusIdx >= 0 && !test ? correctionFor(current.assessment.words[focusIdx], band, profile.homeLanguage) : null;
  /** In a test a word is marked but not explained: no word sheet. */
  const openSheet = test ? undefined : setSheetWord;
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
    phase === 'listening' ? t('speak.status.listening')
      : phase === 'processing' ? t(take.slowHint ? 'speak.status.processing.slow' : 'speak.status.processing')
        : takes.length ? t('speak.status.retry')
          : test ? t('speak.status.first.test')
            : effectivePrompt === 'text' ? t('speak.status.first') : t(`speak.status.first.unseen.${item.lang ? item.lang.slice(0, 2) : 'en'}` as Key);
  const continueText = continueLabel ?? t('common.continue');

  return (
    <div className={`speak speak--${phase}`}>
      <div className="speak__stage">
        <div className={`prompt prompt--${item.kind}`}>
          {item.picture && <div className="prompt__pic" aria-hidden>{item.picture}</div>}
          {!revealed && effectivePrompt === 'translation' ? (
            <><div className="prompt__hint">{t('speak.prompt.translate')}</div><p className="prompt__translation" lang={profile.homeLanguage}>{translation}</p></>
          ) : !revealed ? (
            <p className="prompt__hint prompt__hint--big">{t('speak.prompt.unseen')}</p>
          ) : (
            <p className="prompt__text">
              {item.zh ? (
                <ZhText item={item} script={profile.zhScript}
                  marks={current && phase === 'result' ? current.assessment.words.map((w, i) => ({ tier: w.errorType === 'omission' ? 'missing' : tier(w.score), focus: i === focusIdx, label: t('speak.word.score', { score: w.score }) })) : undefined}
                  onTap={current && phase === 'result' ? openSheet : undefined} />
              ) : current && phase === 'result' && item.ja && beatScores(item.ja, current.assessment) ? (
                // Japanese is marked beat by beat: one weak ら should not paint the whole line red.
                <JaBeats reading={item.ja} assessment={current.assessment} onTap={openSheet ?? (() => undefined)} />
              ) : current && phase === 'result'
                ? current.assessment.words.map((w, i) => (
                  <button key={i} type="button" className={`word word--${w.errorType === 'omission' ? 'missing' : tier(w.score)} ${i === focusIdx ? 'word--focus' : ''}`}
                    onClick={() => openSheet?.(i)} aria-label={t('speak.word.aria', { word: w.word, score: w.score })}>
                    {shown[i] ?? w.word}
                  </button>
                ))
                : item.ja ? <JaText item={{ text: item.text, ja: item.ja }} band={band} /> : item.ko ? <KoText item={{ text: item.text, ko: item.ko }} band={band} /> : item.text}
            </p>
          )}
          {revealed && tm(item.meaning, item.lang) && band !== 'little' && phase !== 'result' && <p className="prompt__meaning">{tm(item.meaning, item.lang)}</p>}

          {phase !== 'result' && !test && (
            <div className="listen-row">
              {revealed ? (
                <>
                  <button type="button" className={`pill ${playing === 'normal' ? 'is-playing' : ''}`} onClick={() => void play('normal')} disabled={busy}><Icon name="speaker" size={20} />{t('common.listen')}</button>
                  <button type="button" className={`pill ${playing === 'slow' ? 'is-playing' : ''}`} onClick={() => void play('slow')} disabled={busy}><Icon name="turtle" size={20} />{t('common.slow')}</button>
                </>
              ) : (
                <button type="button" className="pill" onClick={() => { setRevealed(true); void play('normal'); }} disabled={busy}><Icon name="ear" size={20} />{t('speak.prompt.hint')}</button>
              )}
            </div>
          )}
        </div>

        {phase === 'result' && current && (
          <div className="result" aria-live="polite">
            <div className="result__top">
              <ScoreRing key={takes.length} score={current.assessment.overall} size={band === 'little' ? 132 : 120} stars={band === 'little'} />
              <div className="result__summary">
                {/* A test says how it went, never what to fix: there is no fixing in a test. */}
                <h2 className="result__headline">{test ? t(`speak.result.test.${tier(current.assessment.overall)}`) : headline(current.assessment.overall, band, delta, fixable)}</h2>
                {previous ? (
                  <div className={`delta ${delta! > 0 ? 'delta--up' : delta! < 0 ? 'delta--down' : ''}`}>
                    <span>{rich(t('speak.result.before', { score: previous.assessment.overall }))}</span><Icon name="chevron" size={16} /><span>{rich(t('speak.result.now', { score: current.assessment.overall }))}</span>
                    <em>{delta! > 0 ? `+${delta}` : delta}</em>
                  </div>
                ) : (
                  <p className="result__sub">{test ? t('speak.result.sub.test') : focus && focus.kind !== 'fine' ? t(band === 'little' ? 'speak.result.sub.tip.little' : item.zh ? 'speak.result.sub.tip.char' : 'speak.result.sub.tip.word') : t(item.zh ? 'speak.result.sub.clear.char' : 'speak.result.sub.clear.word')}</p>
                )}
              </div>
            </div>

            {test ? null : focus && focus.kind !== 'fine' ? (
              <button type="button" className={`fix fix--${tier(focus.score)}`} onClick={() => setSheetWord(focusIdx)}>
                <div className="fix__head">
                  {/* One word on screen → name the sound instead of repeating the word with a second, different number. */}
                  <span className="fix__word">{focus.zh ? <>{focus.word} <span className="py">{markSyllable(focus.zh.py)}</span></> : single && focus.phoneme ? t('speak.fix.sound', { label: phonemeInfo(focus.phoneme).label }) : focus.word}</span>
                  <span className="fix__score">{focus.kind === 'omission' ? t('speak.score.missed') : single && focus.phoneme && !focus.zh ? focusPhonemeScore : focus.score}</span>
                </div>
                <div className="fix__row">
                  {focus.kind === 'tone' && focus.zh && focus.zh.expected !== 5 && <ToneContour tone={focus.zh.expected as 1 | 2 | 3 | 4} yours={focus.zh.contour} size={96} />}
                  <div>
                    <p className="fix__problem">{focus.problem}</p>
                    <p className="fix__tip">{rich(t('speak.try', { tip: focus.tip }))}</p>
                  </div>
                </div>
                <span className="fix__more">{t('speak.fix.more')} <Icon name="chevron" size={16} /></span>
              </button>
            ) : (
              <div className="fix fix--good fix--static">
                {fixed ? (
                  <>
                    <div className="fix__head"><span className="fix__word">{t('speak.fix.sound', { label: phonemeInfo(fixed.phoneme).label })}</span><span className="fix__score fix__score--good">{fixed.before} → {fixed.now}</span></div>
                    <p className="fix__problem">{t('speak.fix.fixed')}</p>
                  </>
                ) : <p className="fix__problem">{t('speak.fix.none')}</p>}
              </div>
            )}

            <div className="compare" role="group" aria-label={t('speak.compare.aria')}>
              {!test && <button type="button" className={`pill pill--sm ${playing === 'normal' ? 'is-playing' : ''}`} onClick={() => void play('normal')}><Icon name="speaker" size={18} />{t('speak.compare.teacher')}</button>}
              {!test && <button type="button" className={`pill pill--sm ${veryLow ? 'pill--pulse' : ''} ${playing === 'slow' ? 'is-playing' : ''}`} onClick={() => void play('slow')}><Icon name="turtle" size={18} />{t('common.slow')}</button>}
              {previous && <button type="button" className={`pill pill--sm ${playing === 'before' ? 'is-playing' : ''}`} onClick={() => void play('before')}><Icon name="play" size={14} />{t('speak.compare.before')}</button>}
              <button type="button" className={`pill pill--sm ${playing === 'now' ? 'is-playing' : ''}`} onClick={() => void play('now')}><Icon name="play" size={14} />{t(previous ? 'speak.compare.now' : 'speak.compare.me')}</button>
            </div>
          </div>
        )}

        {phase === 'error' && error && (
          <ErrorPanel code={error} onRetry={startListening}
            onUseDemo={() => { setSettings({ demoMic: true }); setError(null); setView(takes.length ? 'result' : 'ready'); toast(t('speak.toast.demoOn'), '🎛️'); }} />
        )}
      </div>

      <div className="speak__dock">
        {phase !== 'result' && phase !== 'error' && (
          <>
            <div className="speak__coach">
              <Mascot mood={mood} size={isGrownUp(band) ? 64 : 84} />
              <p className="speak__status" aria-live="polite">{status}</p>
            </div>
            <MicButton ref={micRef} state={phase === 'ready' ? 'ready' : phase} onPress={onMic} size={band === 'little' ? 116 : 104} />
          </>
        )}
        {phase === 'result' && current && (
          <div className="speak__actions">
            {!mastered && outOfTries && <p className="speak__kind">{t(test ? 'speak.end.test' : mode === 'check' ? (band === 'adult' ? 'speak.end.check.adult' : 'speak.end.check.kid') : (mode === 'free' ? 'speak.end.free' : 'speak.end.practice'))}</p>}
            {outOfTries || (mastered && !fixable) ? (
              <>
                <Button variant="leaf" size="lg" block onClick={finish}>{continueText}</Button>
                {!outOfTries && current.assessment.overall < 95 && <Button variant="ghost" icon="retry" block onClick={startListening}>{t('speak.action.higher')}</Button>}
              </>
            ) : (
              <>
                {/* A concrete fix is on screen → retrying is the main action, even if the score already passes. */}
                <Button variant="coral" size="lg" icon="mic" block onClick={startListening}>{t(mastered ? 'speak.action.tryFix' : 'common.tryAgain')}</Button>
                {/* The learner's own page ("free"): moving on is always their choice. */}
                {mastered || mode === 'free' ? <Button variant="ghost" block onClick={finish}>{continueText}</Button> : takes.length >= 2 && <Button variant="ghost" block onClick={finish}>{t('common.skipForNow')}</Button>}
              </>
            )}
          </div>
        )}
      </div>

      {current && sheetWord != null && phase === 'result' && (
        <WordSheet
          word={current.assessment.words[sheetWord]} band={band} home={profile.homeLanguage} onClose={() => setSheetWord(null)}
          // Mandarin: say the scorer's (Simplified) character — the word shown may be Traditional.
          onListen={(slow) => void voice.speak((item.zh && hanChars(item.text)[sheetWord]) || current.assessment.words[sheetWord].word, { accent: localeOf(item, profile.accent), slow, ephemeral: mode === 'free' || undefined }).catch((e) => void noSoundMessage(profile.band, e).then((m) => toast(m, '🔇')))}
          onHearMe={() => void play('now')}
          onHearTip={() => { const spoken = inEnglish(() => correctionFor(current.assessment.words[sheetWord], band, profile.homeLanguage).tip); sayTip(spoken); }}
          onRetry={outOfTries ? undefined : startListening}
        />
      )}
    </div>
  );
}

const spokenTip = (a: Assessment, band: AgeBand, home?: HomeLanguage): string | null => {
  const i = focusWordIndex(a);
  if (i < 0) return a.overall >= GOOD ? t('speak.spoken.great') : null;
  const c = correctionFor(a.words[i], band, home);
  return c.kind === 'fine' ? t('speak.spoken.great') : c.tip;
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

