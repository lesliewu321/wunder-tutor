import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHealth, type ApiHealth } from '../../speech';
import { courseFor, courseTitle, unitSubtitle, unitTitle } from '../../content/course';
import { inScript } from '../../content/zh/script';
import { isLongLabel, phonemeInfo } from '../../content/phonemes';
import { dueItems, nextLessonId } from '../../engine/learning';
import { liveStreak, todayXp } from '../../engine/rewards';
import { focusSound, weakSoundsIn } from '../../intelligence/profile';
import { useActiveProfile, useStore } from '../../state/store';
import type { CourseId } from '../../domain/types';
import { Icon } from '../../ui/Icon';
import { Button, ProgressBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { BookHome } from '../say/BookHome';
import { useBook } from '../say/page';

export function Home() {
  const nav = useNavigate();
  const p = useActiveProfile();
  const setCourse = useStore((s) => s.setCourse);
  const COURSE = courseFor(p.course);
  const unit = COURSE.units[0];
  const ids = unit.lessons.map((l) => l.id);
  const nextId = nextLessonId(p, ids);
  const next = unit.lessons.find((l) => l.id === nextId);
  const doneCount = ids.filter((id) => p.lessonsCompleted[id]).length;
  const streak = liveStreak(p.streak);
  const xp = todayXp(p);
  const goalPct = Math.min(1, xp / p.dailyGoalXp);
  const focus = focusSound(p.pronunciation, p.homeLanguage, p.course);
  const focusInfo = phonemeInfo(focus);
  const measured = weakSoundsIn(p.pronunciation, p.course).some((s) => s.phoneme === focus);
  const due = dueItems(p, Date.now()).filter((d) => d.itemId.startsWith('zh-') === (p.course === 'zh')).length;
  const review = unit.lessons[unit.lessons.length - 1];
  const { mode, setMode, page } = useBook(p.id);
  const [api, setApi] = useState<ApiHealth | null>(null);
  useEffect(() => { void apiHealth().then(setApi); }, []);
  // Never let simulated scores pass for real ones.
  const practiceMode = api !== null && !api.azure;

  return (
    <div className="screen home">
      <header className="home__top">
        <button type="button" className="home__me" onClick={() => nav('/me')} aria-label="My profile">
          <span className="home__avatar">{p.avatar}</span>
          <span><small>{greeting()}</small><b>{p.name}</b></span>
        </button>
        <div className="home__stats">
          <span className={`stat-pill ${streak ? 'stat-pill--hot' : ''}`} aria-label={`${streak} day streak`}><Icon name="flame" size={18} fill={!!streak} />{streak}</span>
          <span className="stat-pill stat-pill--xp" aria-label={`${xp} of ${p.dailyGoalXp} XP today`}><Icon name="bolt" size={18} fill />{xp}<small>/{p.dailyGoalXp}</small></span>
        </div>
      </header>

      {/* Two ways to learn: follow the course, or practise a page from a book. */}
      <div className="modes" role="tablist" aria-label="How to learn">
        <button type="button" role="tab" aria-selected={mode === 'course'} className={`mode ${mode === 'course' ? 'is-on' : ''}`} onClick={() => setMode('course')}>
          <span className="mode__icon" aria-hidden><Icon name="home" size={22} /></span>
          <span className="mode__text"><b>Course</b><small>{p.band === 'little' ? 'Lessons' : 'Step-by-step lessons'}</small></span>
        </button>
        <button type="button" role="tab" aria-selected={mode === 'book'} className={`mode ${mode === 'book' ? 'is-on' : ''}`} onClick={() => setMode('book')}>
          <span className="mode__icon" aria-hidden><Icon name="book" size={22} /></span>
          <span className="mode__text"><b>My book</b><small>{page ? `${page.reading.lines.length} sentences` : 'Snap a page'}</small></span>
        </button>
      </div>

      {mode === 'book' ? <BookHome p={p} /> : <>
      <div className="segmented segmented--course" role="group" aria-label="Course">
        {(Object.entries(COURSE_LABEL) as [CourseId, string][]).map(([id, label]) => (
          <button key={id} type="button" className={p.course === id ? 'is-on' : ''} aria-pressed={p.course === id} onClick={() => setCourse(id)}>
            <span lang={id === 'zh' ? (p.zhScript === 'hans' ? 'zh-Hans' : 'zh-Hant') : undefined}>{inScript(label, p.zhScript)}</span>
          </button>
        ))}
      </div>

      {p.course === 'zh' && !p.zhChecked && (
        <button type="button" className="practice-note practice-note--check" onClick={() => nav('/check/zh')}>
          <span aria-hidden>🎤</span>
          <span><b>New: Putonghua with tone checks</b> A one-minute speaking check {p.band === 'adult' ? 'to find' : 'so Pip knows'} which tones and sounds to practise first.</span>
        </button>
      )}

      {practiceMode && (
        <button type="button" className="practice-note" onClick={() => nav('/parents')}>
          <span aria-hidden>🧪</span>
          <span><b>Practice mode — scores are simulated.</b> {api?.needsCode ? (p.band === 'adult' ? 'Enter a beta access code in Settings & privacy to switch on real pronunciation scoring.' : 'A grown-up can enter a beta access code in the Parent Zone to switch on real pronunciation scoring.') : 'Real pronunciation scoring isn’t connected on this device.'}</span>
        </button>
      )}

      <div className="home__cols">
      <div className="home__main">
      <section className="hero" style={{ ['--hero' as string]: unit.color }}>
        <div className="hero__text">
          <span className="hero__unit">{courseTitle(COURSE, p.band)} · Unit 1</span>
          <h1>{unitTitle(unit, p.band)}</h1>
          <p>{next ? <>Next: <b>{next.icon} {next.title}</b></> : due ? <>{due} things are ready to review</> : <>Unit finished — keep your sounds sharp!</>}</p>
          <div className="hero__progress"><ProgressBar value={doneCount / ids.length} tone="sun" /><span>{doneCount}/{ids.length}</span></div>
        </div>
        <Mascot mood="happy" size={104} className="hero__pip" />
        <Button variant="coral" size="lg" block onClick={() => nav(`/lesson/${next?.id ?? review.id}`)}>{doneCount === 0 ? 'Start learning' : next ? 'Continue learning' : 'Review'}</Button>
      </section>

      <button type="button" className="focus-card" onClick={() => nav(`/lab/${encodeURIComponent(focus)}`)}>
        <span className="focus-card__sound" data-long={isLongLabel(focusInfo.label) || undefined}>{focusInfo.label}</span>
        <span className="focus-card__text">
          <small>Today’s pronunciation focus</small>
          <b>{focusInfo.name}</b>
          <em>{measured ? `${p.band === 'adult' ? 'Heard' : 'Pip noticed this one'} in “${focusInfo.example}”` : `Often tricky — like in “${focusInfo.example}”`}</em>
        </span>
        <span className="focus-card__go">2 min<Icon name="chevron" size={18} /></span>
      </button>

      <div className="daily"><div className="daily__row"><b>Today’s goal</b><span>{goalPct >= 1 ? 'Done! 🎉' : `${p.dailyGoalXp - xp} XP to go`}</span></div><ProgressBar value={goalPct} tone="leaf" /></div>

      <button type="button" className="row-link" onClick={() => nav('/speak')}>
        <span className="row-link__icon"><Icon name="chat" /></span>
        <span><b>{p.band === 'adult' ? 'Conversation practice' : 'Talk with Pip'}</b><small>Have a real conversation out loud — at a café, the zoo, with a new friend</small></span>
        <Icon name="chevron" size={20} />
      </button>
      </div>

      <section className="path" aria-label="Lessons">
        <h2 className="section-title">{unit.icon} {unitTitle(unit, p.band)}</h2>
        <ol className="path__list">
          {unit.lessons.map((l, i) => {
            const done = p.lessonsCompleted[l.id];
            const unlocked = i === 0 || !!p.lessonsCompleted[unit.lessons[i - 1].id];
            const current = l.id === nextId;
            return (
              <li key={l.id}>
                <button type="button" className={`node ${done ? 'node--done' : current ? 'node--current' : unlocked ? '' : 'node--locked'}`} disabled={!unlocked} onClick={() => nav(`/lesson/${l.id}`)}>
                  <span className="node__icon">{unlocked ? l.icon : <Icon name="lock" size={22} />}</span>
                  <span className="node__text"><b>{l.title}</b><small>{done ? 'Tap to practise again' : current ? 'Up next' : unlocked ? 'Ready' : `Finish “${unit.lessons[i - 1].title}” first`}</small></span>
                  {done ? p.band === 'adult' ? <span className="node__go node__go--done" aria-label="Done"><Icon name="check" size={16} /></span> : <span className="node__stars" aria-label={`${done.stars} stars`}>{'★'.repeat(done.stars)}<i>{'★'.repeat(3 - done.stars)}</i></span> : current ? <span className="node__go"><Icon name="play" size={16} /></span> : null}
                </button>
              </li>
            );
          })}
        </ol>
        {COURSE.units.slice(1).map((u) => (
          <div key={u.id} className="unit-locked"><span className="unit-locked__icon">{u.icon}</span><span><b>{unitTitle(u, p.band)}</b><small>{unitSubtitle(u, p.band)}</small></span><Icon name="lock" size={20} /></div>
        ))}
      </section>
      </div>
      </>}
    </div>
  );
}

/** Written in Simplified; shown in the learner's script. */
const COURSE_LABEL: Record<CourseId, string> = { en: 'English', zh: '普通话 Putonghua' };

const greeting = (): string => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Hello,' : 'Good evening,';
};
