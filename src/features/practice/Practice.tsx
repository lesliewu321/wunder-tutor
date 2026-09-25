import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contentBand, isGrownUp, type AgeBand, type Assessment, type PhonemeId, type SpeakItem } from '../../domain/types';
import { LADDERS } from '../../content/lab';
import { isZhSound, phonemeInfo, tipFor } from '../../content/phonemes';
import { findScenario, scenarioBlurb, scenariosFor, scenarioTitle } from '../../content/scenarios';
import type { ZhScript } from '../../content/zh/script';
import { badgeName } from '../../engine/rewards';
import { useBack } from '../../back';
import { language, itemMeaning } from '../../i18n';
import { useT } from '../../i18n/useT';
import type { SpeechErrorCode } from '../../speech';
import { localeOf, stopPlayback, voice } from '../../speech/voice';
import { useActiveProfile, useStore } from '../../state/store';
import { correctionFor, focusWordIndex, tier, writtenWords } from '../../tutor/feedback';
import { getTutor, type TutorTurn } from '../../tutor/tutor';
import { Icon } from '../../ui/Icon';
import { Button, IconButton, Sheet, toast, TopBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { MicButton } from '../../ui/MicButton';
import { ItemText } from '../../ui/ItemText';
import { beatScores, JaBeats } from '../../ui/JaText';
import { ZhText } from '../../ui/ZhText';
import { ErrorPanel } from '../speak/ErrorPanel';
import { useSpeechTake } from '../speak/useSpeechTake';

export function PracticeHome() {
  const { t } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  // In the language being learned: a Putonghua learner talks in Putonghua, a French learner in French.
  const scenarios = scenariosFor(p.course);
  return (
    <div className="screen practice">
      <TopBar title={t(p.band === 'adult' ? 'practice.home.title.adult' : 'practice.home.title.kid')} onBack={() => nav('/')} />
      <div className="practice__intro"><Mascot mood="talking" size={92} /><p className="lead">{t(p.band === 'adult' ? 'practice.home.lead.adult' : 'practice.home.lead.kid')}</p></div>
      <ul className="scenario-list">
        {scenarios.map((s) => {
          const last = [...p.conversations].reverse().find((c) => c.scenarioId === s.id);
          return (
            <li key={s.id}>
              <button type="button" className="scenario" style={{ ['--tone' as string]: s.color }} onClick={() => nav(`/speak/${s.id}`)}>
                <span className="scenario__icon">{s.icon}</span>
                <span className="scenario__text"><b>{scenarioTitle(s)}</b><small>{scenarioBlurb(s, contentBand(p.band))}</small></span>
                {last ? <span className={`chip-score chip-score--${tier(last.score)}`}>{last.score}</span> : <Icon name="chevron" size={20} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Line =
  | { role: 'tutor'; it: SpeakItem }
  | { role: 'tip'; text: string }
  | { role: 'child'; it: SpeakItem; assessment: Assessment };

/**
 * A line in its own language: characters with pinyin for Putonghua, and — past the picture-book age — what a line in
 * another language means, as the lessons show it.
 */
export function LineText({ it, band, script }: { it: SpeakItem; band: AgeBand; script: ZhScript }) {
  return (
    <span className="line-text">
      <ItemText item={it} band={band} script={script} />
      {itemMeaning(it) && <small className="bubble__meaning">{itemMeaning(it)}</small>}
    </span>
  );
}

export function Conversation() {
  const { t } = useT();
  const { scenarioId = '' } = useParams();
  const nav = useNavigate();
  const p = useActiveProfile();
  const scenario = findScenario(scenarioId);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const recordConversation = useStore((s) => s.recordConversation);
  const setSettings = useStore((s) => s.setSettings);

  const [lines, setLines] = useState<Line[]>([]);
  const [suggestions, setSuggestions] = useState<SpeakItem[]>([]);
  const [chosen, setChosen] = useState<SpeakItem | null>(null);
  const [thinking, setThinking] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<SpeechErrorCode | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const tips = useRef(0);
  const runId = useRef(0);
  const micRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  // The phone’s Back asks first once the learner has spoken, like the ✕; before that it just goes back.
  useBack(() => { if (done || !lines.some((l) => l.role === 'child')) return false; setConfirmExit(true); return true; });

  // Each line in its own voice: the Mandarin teacher for Putonghua, the French one for French, the learner's accent
  // for English.
  const say = (it: SpeakItem) => voice.speak(it.say ?? it.text, { accent: localeOf(it, p.accent), kind: it.kind }).catch(() => undefined);
  // A tip is advice in the app's language; it is read aloud only when that is English, the teacher's own language.
  const sayTip = (text: string) => (language() === 'en' ? voice.speak(text, { accent: p.accent }).catch(() => undefined) : undefined);

  const tutorTurn = async (history: Line[], note?: string) => {
    if (!scenario) return;
    setThinking(true);
    const run = runId.current;
    const tutor = await getTutor(scenario);
    const turns: TutorTurn[] = history.flatMap((l) => (l.role === 'tip' ? [] : [{ role: l.role, text: l.it.text }]));
    const r = await tutor.next(scenario, p.band, turns, note);
    if (!alive.current || run !== runId.current) return;
    setLines((ls) => [...ls, { role: 'tutor', it: r.reply }]);
    setSuggestions(r.suggestions);
    setChosen(r.suggestions.length === 1 ? r.suggestions[0] : null);
    setThinking(false);
    // Give the goodbye line time to be read even when speech synthesis is unavailable.
    await Promise.all([say(r.reply), r.done ? new Promise((res) => setTimeout(res, 2400)) : null]);
    if (r.done && alive.current) setDone(true);
  };

  useEffect(() => {
    alive.current = true;
    void tutorTurn([]);
    // Bumping the run id orphans any in-flight tutor reply (route change, StrictMode re-mount).
    return () => { alive.current = false; runId.current += 1; stopPlayback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [lines, thinking, chosen, done]);

  const take = useSpeechTake({
    micRef,
    onError: setError,
    onAssessed: async (assessment, rec) => {
      if (!chosen || !scenario) return;
      await recordAttempt({ item: chosen, assessment, audio: rec.blob, context: 'practice', isRetry: false });
      if (!alive.current) return;
      let next: Line[] = [...lines, { role: 'child', it: chosen, assessment }];
      // Let the conversation flow: at most two gentle tips — a clearly mispronounced sound, or a Mandarin tone.
      const fi = focusWordIndex(assessment);
      const c = fi >= 0 ? correctionFor(assessment.words[fi], p.band, p.homeLanguage) : null;
      let note: string | undefined;
      if (c?.phoneme && ((c.kind === 'sound' && c.score < 60) || c.kind === 'tone') && tips.current < 2) {
        tips.current += 1;
        next = [...next, { role: 'tip', text: t('practice.line.tip', { word: c.word, tip: tipFor(c.phoneme, p.band) }) }];
        // Only the live English tutor reads notes.
        if (scenario.course === 'en') note = `The child mispronounced "${c.word}" (sound /${c.phoneme}/). Model the word naturally once in your reply; do not lecture.`;
      }
      setLines(next);
      setChosen(null);
      setSuggestions([]);
      await tutorTurn(next, note);
    },
  });

  if (!scenario) return <div className="screen screen--center"><p>{t('practice.missing.body')}</p><Button onClick={() => nav('/speak')}>{t('common.back')}</Button></div>;
  if (done) return <Summary lines={lines} scenarioId={scenario.id} title={scenarioTitle(scenario)} onSave={recordConversation} />;

  const spoken = lines.filter((l) => l.role === 'child').length;
  return (
    <div className="screen convo" style={{ ['--tone' as string]: scenario.color }}>
      <header className="convo__bar">
        <IconButton icon="close" label={t('practice.leave.button')} onClick={() => (spoken ? setConfirmExit(true) : nav('/speak'))} />
        <div className="convo__title"><span aria-hidden>{scenario.icon}</span><b>{scenarioTitle(scenario)}</b></div>
        <span className="topbar__spacer" />
      </header>

      <div className="convo__scroll">
        {lines.map((l, i) => l.role === 'tutor' ? (
          <div key={i} className="line line--tutor">
            <Mascot mood="idle" size={40} />
            <button type="button" className="bubble" onClick={() => void say(l.it)} aria-label={t('practice.line.play', { text: l.it.text })}><LineText it={l.it} band={p.band} script={p.zhScript} /></button>
          </div>
        ) : l.role === 'tip' ? (
          <div key={i} className="line line--tutor line--tip">
            <button type="button" className="bubble" onClick={() => void sayTip(l.text)}><span aria-hidden>💡 </span>{l.text}</button>
          </div>
        ) : (
          <div key={i} className="line line--child">
            <div className="bubble bubble--me">
              {l.it.zh ? (
                <ZhText item={l.it} script={p.zhScript} marks={l.assessment.words.map((w) => ({ tier: w.errorType === 'omission' ? 'missing' : tier(w.score) }))} />
              ) : l.it.ja && beatScores(l.it.ja, l.assessment) ? (
                <JaBeats reading={l.it.ja} assessment={l.assessment} />
              ) : writtenWords(l.it.text, l.assessment.words).map((word, j) => {
                const w = l.assessment.words[j];
                return <span key={j} className={`w w--${w.errorType === 'omission' ? 'weak' : tier(w.score)}`}>{word} </span>;
              })}
            </div>
            <span className={`chip-score chip-score--${tier(l.assessment.overall)}`}>{l.assessment.overall}</span>
          </div>
        ))}
        {thinking && <div className="line line--tutor"><Mascot mood="thinking" size={40} /><div className="bubble bubble--typing"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>

      <div className="convo__dock">
        {error ? (
          <ErrorPanel code={error} onRetry={() => { setError(null); if (chosen) void take.start(chosen, 0); }}
            onUseDemo={() => { setSettings({ demoMic: true }); setError(null); toast(t('practice.demoMic.toast'), '🎛️'); }} />
        ) : !thinking && suggestions.length > 0 && (
          <>
            <p className="convo__hint">{t(!chosen ? 'practice.hint.choose' : take.phase === 'listening' ? 'practice.hint.listening' : take.phase === 'processing' ? 'practice.hint.processing' : 'practice.hint.ready')}</p>
            <div className="convo__replies">
              {suggestions.map((s) => (
                <button key={s.id} type="button" className={`reply ${chosen?.id === s.id ? 'is-on' : ''}`} disabled={take.phase !== 'idle'} onClick={() => { setChosen(s); void say(s); }}>
                  <LineText it={s} band={p.band} script={p.zhScript} /><Icon name="speaker" size={16} />
                </button>
              ))}
            </div>
            <MicButton ref={micRef} size={84} state={!chosen ? 'disabled' : take.phase === 'idle' ? 'ready' : take.phase}
              onPress={() => (take.phase === 'listening' ? void take.stop() : chosen && void take.start(chosen, 0))} />
          </>
        )}
      </div>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} label={t('practice.leave.sheet')}>
        <div className="confirm"><h2>{t('practice.leave.title')}</h2><p>{t('practice.leave.body')}</p>
          <Button size="lg" block onClick={() => setConfirmExit(false)}>{t('practice.leave.stay')}</Button><Button variant="ghost" block onClick={() => nav('/speak')}>{t('practice.leave.confirm')}</Button></div>
      </Sheet>
    </div>
  );
}

function Summary({ lines, scenarioId, title, onSave }: { lines: Line[]; scenarioId: string; title: string; onSave: ReturnType<typeof useStore.getState>['recordConversation'] }) {
  const { t } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const saved = useRef(false);
  const mine = lines.flatMap((l) => (l.role === 'child' ? [l.assessment] : []));
  const avg = (f: (a: Assessment) => number | undefined) => { const v = mine.map(f).filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  const score = avg((a) => a.overall);

  // Lowest score per sound across the whole conversation → what to practise next.
  const worst = new Map<PhonemeId, number>();
  mine.forEach((a) => a.words.forEach((w) => w.phonemes.forEach((ph) => worst.set(ph.phoneme, Math.min(worst.get(ph.phoneme) ?? 100, ph.score)))));
  const practice = [...worst.entries()].filter(([ph, s]) => s < 78 && phonemeInfo(ph).difficulty >= 0.3).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([ph]) => ph);
  const strong: string[] = [];
  if (avg((a) => a.completeness) >= 98) strong.push(t('practice.summary.strong.everyWord'));
  if (avg((a) => a.fluency) >= 82) strong.push(t('practice.summary.strong.rhythm'));
  if (avg((a) => a.prosody) >= 82) strong.push(t('practice.summary.strong.melody'));
  const clear = [...worst.entries()].filter(([ph, s]) => s >= 88 && phonemeInfo(ph).difficulty >= 0.4).map(([ph]) => t('practice.summary.strong.clearSound', { label: phonemeInfo(ph).label }))[0];
  if (clear) strong.push(clear);
  if (!strong.length) strong.push(t('practice.summary.strong.keptGoing'));

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    onSave({ scenarioId, score, strong, practice }).forEach((a) => toast(badgeName(a), a.icon));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drill = practice.find((ph) => LADDERS[ph]);
  // A grown-up sees the sound's symbol too — an IPA one; a Mandarin tone or pinyin sound has no symbol worth showing.
  const withSymbol = (ph: PhonemeId) => isGrownUp(p.band) && !isZhSound(ph);
  return (
    <div className="screen complete">
      <div className="complete__stage">
        <Mascot mood={score >= 80 ? 'cheer' : 'happy'} size={112} />
        <h1>{t('practice.summary.title')}</h1>
        <p className="complete__lesson">{title}</p>
        <div className="stat-row"><div className="stat"><b>{score}</b><span>{t('practice.summary.stat.pronunciation')}</span></div><div className="stat stat--sun"><b>{mine.length}</b><span>{t('practice.summary.stat.lines')}</span></div></div>
        <div className="card summary">
          <h2><span aria-hidden>💪</span> {t('practice.summary.strong.title')}</h2>
          <ul>{strong.slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ul>
          <h2><span aria-hidden>🎯</span> {t('practice.summary.practise.title')}</h2>
          {practice.length ? <ul>{practice.map((ph) => {
            const info = phonemeInfo(ph);
            // A tone is named as a tone ("Tone 3 · low dip"), not as "the ǎ sound".
            if (info.category === 'tone') return <li key={ph}>{t('practice.summary.practise.tone', { name: info.name, example: info.example })}</li>;
            return <li key={ph}>{t(withSymbol(ph) ? 'practice.summary.practise.sound.symbol' : 'practice.summary.practise.sound', { label: info.label, example: info.example, symbol: ph })}</li>;
          })}</ul> : <p>{t('practice.summary.practise.none')}</p>}
        </div>
      </div>
      <div className="complete__dock">
        {drill && <Button variant="coral" size="lg" icon="mic" block onClick={() => nav(`/lab/${encodeURIComponent(drill)}`)}>{t('practice.summary.drill', { label: phonemeInfo(drill).label })}</Button>}
        <Button variant={drill ? 'ghost' : 'leaf'} size={drill ? 'md' : 'lg'} block onClick={() => nav('/speak')}>{t('common.done')}</Button>
      </div>
    </div>
  );
}
