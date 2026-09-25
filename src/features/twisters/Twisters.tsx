import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { COURSE_LOCALE, findTwister, formatMs, loadBests, saveBests, twisterItem, twisterResult, twistersFor, type TwisterResult } from '../../content/twisters';
import type { Assessment } from '../../domain/types';
import { useT } from '../../i18n/useT';
import { apiFetch, deviceId } from '../../speech/health';
import { localeOf, stopPlayback, voice } from '../../speech/voice';
import type { SpeechErrorCode } from '../../speech';
import { useActiveProfile, useStore } from '../../state/store';
import { handleFor } from '../../engine/handles';
import { tier } from '../../tutor/feedback';
import { Icon } from '../../ui/Icon';
import { ItemText } from '../../ui/ItemText';
import { Button, Confetti, ScoreRing, toast, TopBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { MicButton, type MicState } from '../../ui/MicButton';
import { useSpeechTake } from '../speak/useSpeechTake';

// Tongue twisters (Leslie, 2026-09-25: "add tongue twister gamification … a global/regional leaderboard table too").
// A contest, not a lesson: say it right (the scorer's pass mark, no word missed) as fast as you can. The best passing
// time per twister goes on a board — the world's and the learner's region's — under the learner's nickname and avatar,
// unless a grown-up has switched that off in Settings. No age, no account, no device id ever shows.


interface BoardRow { nickname: string; avatar: string; region: string; ms: number }
interface Board { region: string; global: BoardRow[]; regional: BoardRow[]; me: { ms: number; rank: number; rankRegion: number; region: string } | null }

/** The list: this course's twisters, shortest first, with the learner's best time. */
export function Twisters() {
  const { t } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const list = twistersFor(COURSE_LOCALE[p.course]);
  const bests = loadBests(p.id);
  return (
    <div className="screen lab">
      <TopBar title={t('twisters.title')} onBack={() => nav('/')} />
      <p className="lead">{t('twisters.lead')}</p>
      {list.length === 0 && <p className="fineprint">{t('twisters.none')}</p>}
      <ul className="say__lines">
        {list.map((tw) => {
          const b = bests[tw.id];
          return (
            <li key={tw.id}>
              <button type="button" className="say__line" onClick={() => nav(`/twisters/${tw.id}`)}>
                <span className="say__line-text"><span aria-hidden>{tw.picture} </span>{tw.text} <small className="twister__level">{t(`twisters.level.${tw.level}` as never)}</small></span>
                {b ? <span className="chip-score chip-score--good">{formatMs(b.ms)}</span> : <Icon name="chevron" size={20} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One twister: hear it, say it, get the verdict and the time, see the board. */
export function TwisterPlay() {
  const { t } = useT();
  const nav = useNavigate();
  const { twister = '' } = useParams();
  const p = useActiveProfile();
  const settings = useStore((s) => s.settings);
  const patchProfile = useStore((s) => s.patchProfile);
  const tw = findTwister(twister);
  const item = tw ? twisterItem(tw) : null;
  const micRef = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<TwisterResult | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<SpeechErrorCode | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [side, setSide] = useState<'region' | 'global'>('region');
  const [bests, setBests] = useState(() => loadBests(p.id));
  const [tries, setTries] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopPlayback(); }; }, []);

  const loadBoard = useCallback(async () => {
    if (!tw) return;
    try {
      const res = await apiFetch(`/api/twisters/board?twister=${encodeURIComponent(tw.id)}&device=${encodeURIComponent(deviceId())}`);
      if (res.ok && alive.current) setBoard((await res.json()) as Board);
    } catch { /* the board is a bonus */ }
  }, [tw]);
  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const take = useSpeechTake({
    micRef,
    onError: (code) => setError(code),
    onAssessed: async (a, rec) => {
      const r = twisterResult(a, rec);
      if (!alive.current) return;
      setAssessment(a); setResult(r); setError(null); setTries((n) => n + 1);
      if (!r.passed || !tw) return;
      const prev = bests[tw.id];
      const next = { ...bests, [tw.id]: { ms: prev ? Math.min(prev.ms, r.ms) : r.ms, score: r.score, tries: (prev?.tries ?? 0) + 1 } };
      setBests(next); saveBests(p.id, next);
      // Only a grown-up's say-so puts a nickname on a board; the game works the same without it.
      if (settings.shareScores === false) return;
      try {
        const res = await apiFetch('/api/twisters/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ twister: tw.id, ms: r.ms, score: r.score, nickname: handleFor(p, patchProfile), avatar: p.avatar, device: deviceId() }) });
        if (res.ok) void loadBoard();
      } catch { /* offline: the best stays on the device */ }
    },
  });

  if (!tw || !item) return <div className="screen screen--center"><p>{t('twisters.missing')}</p><Button onClick={() => nav('/twisters')}>{t('twisters.back')}</Button></div>;

  const hear = (slow = false) => { void voice.speak(item.text, { accent: localeOf(item, p.accent), slow, kind: 'sentence' }).catch(() => toast(t('twisters.noSound'), '🔇')); };
  const start = () => { setResult(null); setError(null); stopPlayback(); void take.start(item, tries); };
  const onMic = () => (take.phase === 'listening' ? void take.stop() : start());
  const micState: MicState = take.phase === 'idle' ? 'ready' : take.phase;
  const rows = side === 'region' ? board?.regional ?? [] : board?.global ?? [];
  const mine = bests[tw.id];

  return (
    <div className="screen lab twister">
      <TopBar title={t('twisters.title')} onBack={() => nav('/twisters')} />
      <div className={`prompt prompt--sentence ${result ? (result.passed ? 'twister--pass' : 'twister--fail') : ''}`}>
        <div className="prompt__pic" aria-hidden>{tw.picture}</div>
        <p className="prompt__text"><ItemText item={item} band={p.band} script={p.zhScript} /></p>
        <div className="listen-row">
          <button type="button" className="pill" onClick={() => hear(false)}><Icon name="speaker" size={20} />{t('common.listen')}</button>
          <button type="button" className="pill" onClick={() => hear(true)}><Icon name="turtle" size={20} />{t('common.slow')}</button>
        </div>
      </div>

      {result && assessment && (
        <div className="result" aria-live="polite">
          {result.passed && <Confetti count={20} />}
          <div className="result__top">
            <ScoreRing score={result.score} size={104} />
            <div className="result__summary">
              <h2 className="result__headline">{t(result.passed ? 'twisters.pass' : 'twisters.fail')}</h2>
              <p className="result__sub">{result.passed ? t('twisters.time', { time: formatMs(result.ms) }) : result.missed.length ? t('twisters.missed', { words: result.missed.join(', ') }) : t('twisters.notClear', { pass: String(Math.round(assessment.overall)) })}</p>
            </div>
          </div>
          {mine && <p className="fineprint">{t('twisters.best', { time: formatMs(mine.ms) })}</p>}
        </div>
      )}
      {error && <p className="practice-note" role="note"><span aria-hidden>🎙️</span><span>{t('twisters.micProblem')}</span></p>}

      <div className="speak__dock twister__dock">
        <div className="speak__coach"><Mascot mood={take.phase === 'listening' ? 'listening' : result?.passed ? 'cheer' : 'idle'} size={64} /><p className="speak__status">{t(take.phase === 'listening' ? 'twisters.status.go' : take.phase === 'processing' ? 'twisters.status.checking' : 'twisters.status.ready')}</p></div>
        <MicButton ref={micRef} state={micState} onPress={onMic} size={96} />
      </div>

      <section className="board">
        <h2 className="section-title">{t('twisters.board.title')}</h2>
        <div className="chips" role="tablist">
          <button type="button" role="tab" className={`chip ${side === 'region' ? 'is-on' : ''}`} aria-selected={side === 'region'} onClick={() => setSide('region')}>{t('twisters.board.region', { region: board?.region ?? '' })}</button>
          <button type="button" role="tab" className={`chip ${side === 'global' ? 'is-on' : ''}`} aria-selected={side === 'global'} onClick={() => setSide('global')}>{t('twisters.board.world')}</button>
        </div>
        {rows.length === 0 ? <p className="fineprint">{t('twisters.board.empty')}</p> : (
          <ol className="say__lines">
            {rows.map((r, i) => (
              <li key={`${r.nickname}-${i}`}><span className="say__line"><span className="say__line-text"><b>{i + 1}.</b> {r.avatar} {r.nickname}<small className="twister__level">{r.region}</small></span><span className={`chip-score chip-score--${tier(i < 3 ? 95 : 80)}`}>{formatMs(r.ms)}</span></span></li>
            ))}
          </ol>
        )}
        {board?.me && <p className="fineprint">{t('twisters.board.you', { rank: String(side === 'region' ? board.me.rankRegion : board.me.rank), time: formatMs(board.me.ms) })}</p>}
        {settings.shareScores === false && <p className="fineprint">{t('twisters.board.off')}</p>}
      </section>
    </div>
  );
}
