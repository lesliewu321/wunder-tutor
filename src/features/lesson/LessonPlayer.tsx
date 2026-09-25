import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Achievement, Exercise, PhonemeId, SpeakItem } from '../../domain/types';
import { COURSES, findLesson, ITEM_INDEX, lessonTitle } from '../../content/course';
import { bonusTwister, type Twister } from '../../content/twisters';
import { RETEST_BELOW } from '../../engine/testing';
import { LADDERS } from '../../content/lab';
import { exampleSpeech, phonemeInfo, soundLocale, tipFor } from '../../content/phonemes';
import { shownText } from '../../content/zh/script';
import { canSkip, drillFor, exercisesFor, FAST_TRACK_SCORE, isDrill } from '../../engine/learning';
import { badgeDetail, badgeName, liveStreak } from '../../engine/rewards';
import { useBack } from '../../back';
import { tl, tm } from '../../i18n';
import { LiteracyExercise } from './LiteracyExercise';
import { useT } from '../../i18n/useT';
import { localeOf, stopPlayback, voice } from '../../speech/voice';
import { type TestRecord } from '../../domain/types';
import { tier } from '../../tutor/feedback';
import { useActiveProfile, useStore, type LessonOutcome } from '../../state/store';
import { Button, Confetti, IconButton, ProgressBar, Sheet, toast } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { Mascot } from '../../ui/Mascot';
import { Mouth } from '../../ui/Mouth';
import { ToneContour } from '../../ui/ToneContour';
import { ItemText } from '../../ui/ItemText';
import { SpeakExercise, type SpeakResult } from '../speak/SpeakExercise';
import { ChoiceExercise } from './ChoiceExercise';

type Step = Exercise | { id: string; type: 'drill-intro'; sound: PhonemeId };
interface ItemResult extends SpeakResult { text: string; itemId: string }

/** A fresh player for every visit: "Take it again" changes the address, and everything starts over. */
export function LessonPlayer() {
  const loc = useLocation();
  return <LessonRun key={loc.pathname + loc.search} />;
}

function LessonRun() {
  const { t } = useT();
  const { lessonId = '' } = useParams();
  const [params] = useSearchParams();
  // Test mode (Leslie, 2026-09-25: "same lessons but without teacher"): the very same exercises, nothing to listen
  // to, no tips, one go per item, no drills slipped in and no fast track — and a score sheet instead of stars.
  const test = params.get('mode') === 'test';
  const nav = useNavigate();
  const profile = useActiveProfile();
  const completeLesson = useStore((s) => s.completeLesson);
  const completeTest = useStore((s) => s.completeTest);
  const finishItem = useStore((s) => s.finishItem);
  const lesson = findLesson(lessonId);

  // The queue is built once per visit — adaptation edits it in place as the child performs.
  const initial = useMemo<Step[]>(() => (lesson ? exercisesFor(lesson, profile) : []), [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [queue, setQueue] = useState<Step[]>(initial);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [listenScore, setListenScore] = useState({ right: 0, total: 0 });
  const [confirmExit, setConfirmExit] = useState(false);
  const [started, setStarted] = useState(test || !lesson?.guide);
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [testDone, setTestDone] = useState<TestRecord | null>(null);
  useEffect(() => { if (test && lesson) toast(t('lesson.test.start'), '📝'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const strong = useRef(0);
  const drilled = useRef(new Set<PhonemeId>());
  const startXp = useRef(profile.xp);
  // The unit this lesson belongs to, and whether it was already finished before this visit: the bonus round is for
  // the moment a unit is completed, not for every replay.
  const unitIds = useMemo(() => Object.values(COURSES).flatMap((c) => c.units).find((u) => u.lessons.some((l) => l.id === lessonId))?.lessons.map((l) => l.id) ?? [], [lessonId]);
  const unitWasDone = useRef(unitIds.length > 0 && unitIds.every((id) => profile.lessonsCompleted[id]));

  // The phone's Back asks first, like the ✕: leaving throws the lesson away. A finished lesson just goes back.
  useBack(() => { if (!lesson || outcome || testDone) return false; setConfirmExit(true); return true; });

  useEffect(() => () => stopPlayback(), []);

  // Fetch the next teacher take while the child is busy with this one, so Listen is instant — whatever the next
  // exercise is. Listening exercises and the tutor's line play by themselves the moment they appear, so a wait there
  // (a hard line can take the server ten seconds) looked like no sound at all.
  useEffect(() => {
    const next = queue[index + 1];
    if (!next) return;
    const line = next.type === 'speak' ? next.item : next.type === 'choose-heard' ? next.answer : next.type === 'minimal-pair' ? next.pair[next.answerIndex] : null;
    if (line) voice.prefetch(line.say ?? line.text, { accent: localeOf(line, profile.accent), kind: line.kind });
    else if (next.type === 'dialogue') voice.prefetch(next.tutorLine, { accent: localeOf(next.tutor, profile.accent) });
  }, [queue, index, profile.accent]);

  if (!lesson) {
    return <div className="screen screen--center"><p>{t('lesson.missing.body')}</p><Button onClick={() => nav('/')}>{t('lesson.missing.home')}</Button></div>;
  }

  const finishLesson = (all: ItemResult[], checks = listenScore) => {
    const spoken = all.filter((r) => r.tries > 0);
    const avg = lesson.guide && spoken.length + checks.total > 0
      ? Math.round((spoken.reduce((n, r) => n + r.best, 0) + checks.right * 100) / (spoken.length + checks.total))
      : spoken.length ? Math.round(spoken.reduce((n, r) => n + r.best, 0) / spoken.length)
      : checks.total ? Math.round((checks.right / checks.total) * 100) : 100;
    if (test) {
      // A weak test score is evidence: the item goes back onto the review schedule, and the next Review picks it up.
      for (const r of all) if (r.tries > 0 && r.best < RETEST_BELOW) { const it = ITEM_INDEX[r.itemId]; if (it) finishItem(it, r.best, false, 1); }
      setTestDone(completeTest(lesson.id, avg));
    }
    else setOutcome(completeLesson(lesson.id, avg));
  };

  const advance = (nextQueue: Step[], all: ItemResult[], checks = listenScore) => {
    if (index + 1 >= nextQueue.length) finishLesson(all, checks);
    else setIndex(index + 1);
  };

  const onSpeakDone = (ex: Extract<Exercise, { type: 'speak' }> | { item: SpeakItem; id: string }, r: SpeakResult) => {
    const all = [...results, { ...r, text: shownText(ex.item), itemId: ex.item.id }];
    setResults(all);
    if (test) { advance(queue, all); return; }
    let next = queue;

    // Struggling → isolate the sound: mouth guide, then syllable → word, before moving on.
    const sound = r.troubleSound;
    // One drill per lesson keeps it inside the 3–7 minute budget; other weak sounds resurface via review and the Lab.
    if (sound && LADDERS[sound] && drilled.current.size === 0 && !('type' in ex && isDrill(ex as Exercise)) && (r.tries >= 2 || !r.mastered)) {
      drilled.current.add(sound);
      next = [...queue.slice(0, index + 1), { id: `intro-${sound}`, type: 'drill-intro', sound }, ...drillFor(sound, ex.item.text), ...queue.slice(index + 1)];
    }

    // Flying → drop repeats of things already solid from earlier sessions.
    strong.current = r.first >= FAST_TRACK_SCORE ? strong.current + 1 : 0;
    if (strong.current >= 3) {
      const ahead = next.slice(index + 1);
      const kept = ahead.filter((s) => s.type === 'drill-intro' || !canSkip(s, profile));
      if (kept.length < ahead.length && kept.length > 0) {
        next = [...next.slice(0, index + 1), ...kept];
        toast(t('lesson.fastTrack.toast'), '🚀');
      }
      strong.current = 0;
    }
    setQueue(next);
    advance(next, all);
  };

  if (testDone) return <TestComplete lessonId={lesson.id} title={lessonTitle(lesson)} results={results} record={testDone} listen={listenScore} />;
  if (outcome) {
    const unitDone = !unitWasDone.current && unitIds.length > 0 && unitIds.every((id) => profile.lessonsCompleted[id]);
    return <LessonComplete title={lessonTitle(lesson)} results={results} outcome={outcome} xpGained={profile.xp - startXp.current} streak={liveStreak(profile.streak)} listen={listenScore} bonus={unitDone ? bonusTwister(profile.course, profile.id) : null} />;
  }

  const checked = (first: boolean) => {
    const checks = { right: listenScore.right + (first ? 1 : 0), total: listenScore.total + 1 };
    setListenScore(checks);
    advance(queue, results, checks);
  };
  if (!started && lesson.guide) {
    const g = lesson.guide;
    return <div className="screen lesson-guide">
      <IconButton icon="close" label={t('lesson.leave.button')} onClick={() => nav('/')} />
      <span className="lesson-guide__icon" aria-hidden>{lesson.icon}</span>
      <h1>{lessonTitle(lesson)}</h1>
      <div className="card"><h2>{t('lesson.guide.goal')}</h2><p>{tl(g.goal, g.goalHant)}</p></div>
      <div className="card"><h2>{t('lesson.guide.tip')}</h2><p>{tl(g.tip, g.tipHant)}</p></div>
      <div className="card"><h2>{t('lesson.guide.practice')}</h2><p>{tl(g.practice, g.practiceHant)}</p></div>
      <Button size="lg" variant="primary" block onClick={() => setStarted(true)}>{t('lesson.guide.start')}</Button>
    </div>;
  }
  const step = queue[index];
  return (
    <div className="screen lesson">
      <header className="lesson__bar">
        <IconButton icon="close" label={t('lesson.leave.button')} onClick={() => setConfirmExit(true)} />
        <ProgressBar value={index / queue.length} tone="leaf" />
        <span className="lesson__count">{index + 1}/{queue.length}</span>
      </header>

      <div className="lesson__body" key={step.id}>
        {step.type === 'speak' && <SpeakExercise item={step.item} prompt={step.prompt} context={test ? 'test' : 'lesson'} mode={test ? 'test' : 'practice'} onDone={(r) => onSpeakDone(step, r)} />}
        {(step.type === 'choose-heard' || step.type === 'minimal-pair') && (
          <ChoiceExercise ex={step} test={test} onDone={checked} />
        )}
        {(step.type === 'read-choice' || step.type === 'arrange') && <LiteracyExercise ex={step} test={test} onDone={checked} />}
        {step.type === 'dialogue' && <DialogueExercise ex={step} test={test} onDone={(it, r) => onSpeakDone({ item: it, id: step.id }, r)} />}
        {step.type === 'drill-intro' && <DrillIntro sound={step.sound} onDone={() => advance(queue, results)} />}
      </div>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} label={t('lesson.leave.sheet')}>
        <div className="confirm">
          <Mascot mood="encourage" size={88} />
          <h2>{t('lesson.leave.title')}</h2>
          <p>{t('lesson.leave.body')}</p>
          <Button variant="primary" size="lg" block onClick={() => setConfirmExit(false)}>{t('lesson.leave.stay')}</Button>
          <Button variant="ghost" block onClick={() => nav('/')}>{t('lesson.leave.confirm')}</Button>
        </div>
      </Sheet>
    </div>
  );
}

function DrillIntro({ sound, onDone }: { sound: PhonemeId; onDone: () => void }) {
  const { t } = useT();
  const profile = useActiveProfile();
  const info = phonemeInfo(sound);
  // A tone goes by the short half of its name: "Tone 1 · high and flat" → "tone 1" (a translation keeps the " · ").
  const tone = info.name.split(' · ')[0].toLowerCase();
  return (
    <div className="drill-intro">
      <div className="drill-intro__stage">
        <span className="tag tag--sun">{t('lesson.drill.tag')}</span>
        <h2>{info.category === 'tone' ? t('lesson.drill.title.tone', { tone }) : t('lesson.drill.title.sound', { label: info.label })}</h2>
        {info.category === 'tone' ? <ToneContour tone={Number(sound.slice(-1)) as 1 | 2 | 3 | 4} size={210} /> : <Mouth pose={info.pose} size={210} />}
        <p className="drill-intro__tip">{tipFor(sound, profile.band)}</p>
        <button type="button" className="pill" onClick={() => void voice.speak(exampleSpeech(sound), { accent: soundLocale(sound, profile.accent), slow: true }).catch(() => undefined)}>🔈 {t('lesson.drill.hear', { example: info.example })}</button>
      </div>
      <div className="drill-intro__dock"><Button variant="primary" size="lg" block onClick={onDone}>{t('lesson.drill.ready')}</Button></div>
    </div>
  );
}

function DialogueExercise({ ex, onDone, test = false }: { ex: Extract<Exercise, { type: 'dialogue' }>; onDone: (item: SpeakItem, r: SpeakResult) => void; test?: boolean }) {
  const { t } = useT();
  const profile = useActiveProfile();
  const [choice, setChoice] = useState<SpeakItem | null>(ex.replies.length === 1 ? ex.replies[0] : null);

  const tutorLocale = localeOf(ex.tutor, profile.accent);
  useEffect(() => {
    const timer = setTimeout(() => void voice.speak(ex.tutorLine, { accent: tutorLocale }).catch(() => undefined), 400);
    return () => { clearTimeout(timer); stopPlayback(); };
  }, [ex.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bubble = (
    <div className="bubble-row">
      <span className="bubble-row__who" aria-hidden>{ex.picture ?? '🧑‍🍳'}</span>
      <button type="button" className="bubble" onClick={() => void voice.speak(ex.tutorLine, { accent: tutorLocale }).catch(() => undefined)}>
        {ex.tutor ? <ItemText item={ex.tutor} band={profile.band} script={profile.zhScript} /> : ex.tutorLine} <span aria-hidden>🔈</span>
        {ex.tutor?.lang && tm(ex.tutor.meaning, ex.tutor.lang) && profile.band !== 'little' && <small className="bubble__meaning">{tm(ex.tutor.meaning, ex.tutor.lang)}</small>}
      </button>
    </div>
  );

  if (!choice) {
    return (
      <div className="dialogue">
        {bubble}
        <h2 className="dialogue__title">{t('lesson.dialogue.title')}</h2>
        <div className="dialogue__replies">
          {ex.replies.map((r) => (
            <button key={r.id} type="button" className="reply" onClick={() => setChoice(r)}>{r.picture && <span aria-hidden>{r.picture}</span>}<ItemText item={r} band={profile.band} script={profile.zhScript} /></button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="dialogue dialogue--speaking">
      {bubble}
      <SpeakExercise item={choice} context={test ? 'test' : 'lesson'} mode={test ? 'test' : 'practice'} onDone={(r) => onDone(choice, r)} />
    </div>
  );
}

/** The score sheet: every line said, with its score; the listening tally; the best so far. No stars, no confetti — a test measures. */
function TestComplete({ lessonId, title, results, record, listen }: { lessonId: string; title: string; results: ItemResult[]; record: TestRecord; listen: { right: number; total: number } }) {
  const { t } = useT();
  const nav = useNavigate();
  const spoken = results.filter((r) => r.tries > 0);
  return (
    <div className="screen complete">
      <div className="complete__stage">
        <Mascot mood={record.score >= 75 ? 'cheer' : 'happy'} size={112} />
        <h1>{t('lesson.test.title')}</h1>
        <p className="complete__lesson">{title}</p>
        <div className="stat-row">
          <div className="stat"><b>{record.score}</b><span>{t('lesson.test.score')}</span></div>
          {listen.total > 0 && <div className="stat"><b>{listen.right}/{listen.total}</b><span>{t('lesson.complete.stat.listening')}</span></div>}
        </div>
        {record.taken > 1 && <p className="complete__lesson">{t('lesson.test.best', { n: record.best })}</p>}
        {spoken.length > 0 && (
          <ol className="say__lines">
            {spoken.map((r, i) => (
              <li key={i}><span className="say__line"><span className="say__line-text">{r.text}</span><span className={`chip-score chip-score--${tier(r.best)}`}>{r.best}</span></span></li>
            ))}
          </ol>
        )}
      </div>
      <div className="complete__dock">
        <Button variant="leaf" size="lg" block onClick={() => nav('/')}>{t('lesson.test.home')}</Button>
        <Button variant="ghost" block onClick={() => nav(`/lesson/${lessonId}?mode=test&again=${Date.now()}`, { replace: true })}>{t('lesson.test.again')}</Button>
      </div>
    </div>
  );
}

function LessonComplete({ title, results, outcome, xpGained, streak, listen, bonus }: {
  title: string; results: ItemResult[]; outcome: LessonOutcome; xpGained: number; streak: number; listen: { right: number; total: number };
  /** A unit was just finished: a tongue twister as a bonus round (Leslie, 2026-09-25). */
  bonus: Twister | null;
}) {
  const { t } = useT();
  const nav = useNavigate();
  const profile = useActiveProfile();
  const spoken = results.filter((r) => r.tries > 0);
  const avg = spoken.length ? Math.round(spoken.reduce((n, r) => n + r.best, 0) / spoken.length) : null;
  const improved = [...spoken].filter((r) => r.best - r.first >= 5).sort((a, b) => b.best - b.first - (a.best - a.first))[0];
  const masteredCount = spoken.filter((r) => r.mastered).length;
  const again = spoken.filter((r) => !r.mastered);

  return (
    <div className="screen complete">
      <Confetti />
      <div className="complete__stage">
        <Mascot mood="cheer" size={132} />
        <h1>{t('lesson.complete.title')}</h1>
        <p className="complete__lesson">{title}</p>
        <div className="complete__stars" aria-label={t('lesson.complete.stars', { n: outcome.stars })}>
          {[0, 1, 2].map((i) => <span key={i} className={i < outcome.stars ? 'on' : ''} style={{ animationDelay: `${250 + i * 180}ms` }}>★</span>)}
        </div>

        <div className="stat-row">
          {avg != null && <div className="stat"><b>{avg}</b><span>{t('lesson.complete.stat.pronunciation')}</span></div>}
          {avg == null && listen.total > 0 && <div className="stat"><b>{listen.right}/{listen.total}</b><span>{t('lesson.complete.stat.listening')}</span></div>}
          <div className="stat stat--sun"><b>+{xpGained}</b><span>{t('lesson.complete.stat.xp')}</span></div>
          <div className="stat stat--coral"><b>{streak}</b><span>{t('lesson.complete.stat.streak')}</span></div>
        </div>

        {improved && (
          <div className="card callout">
            <span className="callout__icon" aria-hidden>📈</span>
            <div><b>{t('lesson.complete.improved.title')}</b><p>{t('lesson.complete.improved.body', { text: improved.text, from: improved.first, to: improved.best })}</p></div>
          </div>
        )}
        {spoken.length > 0 && (
          <div className="card callout">
            <span className="callout__icon" aria-hidden>{again.length ? '🔁' : '✅'}</span>
            <div>
              <b>{t('lesson.complete.mastered.title', { n: masteredCount, total: spoken.length })}</b>
              <p>{!again.length ? t('lesson.complete.mastered.all')
                : t(profile.band === 'adult' ? 'lesson.complete.mastered.again.adult' : 'lesson.complete.mastered.again.kid', { text: again[0].text })}</p>
            </div>
          </div>
        )}
        {bonus && (
          <button type="button" className="card callout callout--bonus" onClick={() => nav(`/twisters/${bonus.id}`)}>
            <span className="callout__icon" aria-hidden>🌀</span>
            <div>
              <b>{t('lesson.complete.bonus.title')}</b>
              <p>{t(profile.band === 'adult' ? 'lesson.complete.bonus.body.adult' : 'lesson.complete.bonus.body')}</p>
              <p className="callout__twister"><span aria-hidden>{bonus.picture}</span> {bonus.text}</p>
              <span className="callout__go">{t('lesson.complete.bonus.go')} <Icon name="chevron" size={18} /></span>
            </div>
          </button>
        )}
        {outcome.achievements.map((a: Achievement) => (
          <div key={a.id} className="card callout callout--badge"><span className="callout__icon" aria-hidden>{a.icon}</span><div><b>{badgeName(a)}</b><p>{badgeDetail(a)}</p></div></div>
        ))}
      </div>
      <div className="complete__dock">
        <Button variant="leaf" size="lg" block onClick={() => nav('/')}>{t('common.continue')}</Button>
        <Button variant="ghost" block onClick={() => nav('/progress')}>{t(profile.band === 'little' ? 'lesson.complete.progress.little' : 'lesson.complete.progress.older')}</Button>
      </div>
    </div>
  );
}
