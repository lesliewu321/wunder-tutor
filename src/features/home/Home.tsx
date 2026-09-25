import { WeeklyChallenge } from '../../notifications/Notifications';
import { ageGuidance, stageLabel } from '../../../astra-lessons/curriculum';
import { useEffect, useState } from 'react';
import { LessonMap, sceneFor, type MapNode } from './LessonMap';
import { useNavigate } from 'react-router-dom';
import { apiHealth, type ApiHealth } from '../../speech';
import { courseFor, courseTitle, ITEM_INDEX, lessonTitle, unitSubtitle, unitTitle } from '../../content/course';
import { isLongLabel, phonemeInfo } from '../../content/phonemes';
import { courseLessons, currentUnit, lessonUnlocked } from '../../engine/curriculum';
import { dueItems, itemCourse, nextLessonId } from '../../engine/learning';
import { liveStreak, todayXp } from '../../engine/rewards';
import { focusSound, weakSoundsIn } from '../../intelligence/profile';
import { testDue } from '../../engine/testing';
import { useActiveProfile, useStore } from '../../state/store';
import { activeSeasons } from '../../content/seasonal';
import type { CourseId } from '../../domain/types';
import { dateLocale, type Key } from '../../i18n';
import { rich, useT } from '../../i18n/useT';
import { Icon } from '../../ui/Icon';
import { Button, ProgressBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';

export function Home() {
  const { t, tn, tc } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const setCourse = useStore((s) => s.setCourse);
  // Festival bonus lessons on now for this learner's courses (content/seasonal/events.json).
  const seasons = activeSeasons(new Date(), p.learning);
  const COURSE = courseFor(p.course, p.band);
  const unit = currentUnit(COURSE, p.lessonsCompleted);
  const lessons = courseLessons(COURSE);
  const [selected, setSelected] = useState<{ course: CourseId; unitId: string } | null>(null);
  const pathUnit = COURSE.units.find((u) => selected?.course === p.course && u.id === selected.unitId && !u.locked && u.lessons.length) ?? unit;
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
  // What this course's Review would hand out: items of this course that a review can find (buildReview).
  const due = dueItems(p, Date.now()).filter((d) => { const it = ITEM_INDEX[d.itemId]; return !!it && itemCourse(it) === p.course; }).length;
  const review = unit.lessons[unit.lessons.length - 1];
  const [api, setApi] = useState<ApiHealth | null>(null);
  // Learn or Test (Leslie, 2026-09-25): the same path, but a node opens the lesson without the teacher. Remembered
  // per learner on this device. A child tests only what they have learnt; grown-ups may test anything.
  const [pathMode, setPathModeState] = useState<'learn' | 'test'>(() => { try { return localStorage.getItem(`wunder-tutor/path-mode/${p.id}`) === 'test' ? 'test' : 'learn'; } catch { return 'learn'; } });
  const setPathMode = (m: 'learn' | 'test') => { setPathModeState(m); try { localStorage.setItem(`wunder-tutor/path-mode/${p.id}`, m); } catch { /* private mode */ } };
  const testing = pathMode === 'test';
  // Map or list (Leslie, 2026-09-25: the scenic map as a "course alternative"): the map by default, remembered per learner.
  const [pathView, setPathViewState] = useState<'map' | 'list'>(() => { try { return localStorage.getItem(`wunder-tutor/path-view/${p.id}`) === 'list' ? 'list' : 'map'; } catch { return 'map'; } });
  const setPathView = (v: 'map' | 'list') => { setPathViewState(v); try { localStorage.setItem(`wunder-tutor/path-view/${p.id}`, v); } catch { /* private mode */ } };
  // A test that is worth taking now (engine/testing.ts), shown on the hero once a day at most; the path tags it too.
  const dueTest = unit.lessons.find((l) => testDue(p, l.id, ids));
  const today = new Date().toDateString();
  const [nudged, setNudged] = useState(() => { try { return localStorage.getItem(`wunder-tutor/test-nudge/${p.id}`) === today; } catch { return false; } });
  const showTest = !!dueTest && !nudged && !testing;
  useEffect(() => { if (showTest) { try { localStorage.setItem(`wunder-tutor/test-nudge/${p.id}`, today); } catch { /* private mode */ } } }, [showTest, p.id, today]); // eslint-disable-line react-hooks/exhaustive-deps
  void setNudged;
  useEffect(() => { void apiHealth().then(setApi); }, []);
  // Never let simulated scores pass for real ones.
  const practiceMode = api !== null && !api.azure;

  return (
    <div className="screen home">
      <header className="home__top">
        <button type="button" className="home__me" onClick={() => nav('/me')} aria-label={t('home.profile.aria')}>
          <span className="home__avatar">{p.avatar}</span>
          <span><small>{t(greeting())}</small><b>{p.name}</b></span>
        </button>
        <div className="home__stats">
          <button type="button" className="icon-btn" aria-label={t('notify.title')} onClick={() => nav('/notifications')}><Icon name="bell" size={22} /></button>
          <span className={`stat-pill ${streak ? 'stat-pill--hot' : ''}`} aria-label={t('home.streak.aria', { n: streak })}><Icon name="flame" size={18} fill={!!streak} />{streak}</span>
          <span className="stat-pill stat-pill--xp" aria-label={t('home.xp.aria', { xp, goal: p.dailyGoalXp })}><Icon name="bolt" size={18} fill />{xp}<small>/{p.dailyGoalXp}</small></span>
        </div>
      </header>

      {/* The course switch lives on the Profile tab (Leslie, 2026-09-25: "course should be located in me"); the card below
          names the course on screen. */}
      {p.course === 'zh' && !p.zhChecked && (
        <button type="button" className="practice-note practice-note--check" onClick={() => nav('/check/zh')}>
          <span aria-hidden>🎤</span>
          <span><b>{t('home.zhCheck.title')}</b> {t(p.band === 'adult' ? 'home.zhCheck.body.adult' : 'home.zhCheck.body.kid')}</span>
        </button>
      )}

      {practiceMode && (
        <button type="button" className="practice-note" onClick={() => nav('/parents')}>
          <span aria-hidden>🧪</span>
          <span><b>{t('home.practiceMode.title')}</b> {t(api?.needsCode ? (p.band === 'adult' ? 'home.practiceMode.code.adult' : 'home.practiceMode.code.kid') : 'home.practiceMode.notConnected')}</span>
        </button>
      )}

      <div className="home__cols">
      <div className="home__main">
      <section className="hero" style={{ ['--hero' as string]: unit.color }}>
        <div className="hero__text">
          <span className="hero__unit">{t('home.hero.unit', { course: courseTitle(COURSE, p.band), n: COURSE.units.indexOf(unit) + 1 })}</span>
          <h1>{unitTitle(unit, p.band)}</h1>
          <p>{showTest && dueTest ? rich(t('home.hero.test', { title: `${dueTest.icon} ${lessonTitle(dueTest)}` })) : next ? rich(t('home.hero.next', { title: `${next.icon} ${lessonTitle(next)}` })) : due ? tn('home.hero.due', due) : t('home.hero.finished')}</p>
          <div className="hero__progress"><ProgressBar value={doneCount / ids.length} tone="sun" /><span>{doneCount}/{ids.length}</span></div>
        </div>
        <Mascot mood="happy" size={104} className="hero__pip" />
        {showTest && dueTest
          ? <Button variant="coral" size="lg" block onClick={() => nav(`/lesson/${dueTest.id}?mode=test`)}>{t('home.hero.takeTest')}</Button>
          : <Button variant="coral" size="lg" block onClick={() => nav(`/lesson/${next?.id ?? review.id}`)}>{t(doneCount === 0 ? 'home.hero.start' : next ? 'home.hero.continue' : 'home.hero.review')}</Button>}
      </section>

      {/* A festival's bonus lesson while it is on (Leslie, 2026-09-25: "push lessons for chinese learners" at Mid-Autumn).
          It opens in its own course, switching to it if the learner was on another. */}
      {seasons.map(({ event, course, lesson, day }) => (
        <button key={event.id} type="button" className="season-card" onClick={() => { if (p.course !== course) setCourse(course); nav(`/lesson/${lesson.id}`); }}>
          <span className="season-card__icon" aria-hidden>{event.icon}</span>
          <span className="season-card__text">
            <small>{t('home.season.tag')} · <i>{day.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}</i> · <i>{t(course === 'en' ? 'common.course.en' : `settings.me.course.${course}` as Key)}</i></small>
            <b>{tc(`season.${event.id}.title`, event.title)}</b>
            <span>{tc(`season.${event.id}.blurb`, event.blurb)}</span>
          </span>
          <span className="season-card__go">{t(p.lessonsCompleted[lesson.id] ? 'home.season.again' : 'home.season.go')}</span>
        </button>
      ))}

      <button type="button" className="focus-card" onClick={() => nav(`/lab/${encodeURIComponent(focus)}`)}>
        <span className="focus-card__sound" data-long={isLongLabel(focusInfo.label) || undefined}>{focusInfo.label}</span>
        <span className="focus-card__text">
          <small>{t('home.focus.label')}</small>
          <b>{focusInfo.name}</b>
          <em>{t(measured ? (p.band === 'adult' ? 'home.focus.heard.adult' : 'home.focus.heard.kid') : 'home.focus.tricky', { example: focusInfo.example })}</em>
        </span>
        <span className="focus-card__go">{t('home.focus.time')}<Icon name="chevron" size={18} /></span>
      </button>

      <div className="daily"><div className="daily__row"><b>{t('home.daily.title')}</b><span>{goalPct >= 1 ? `${t('home.daily.done')} 🎉` : t('home.daily.toGo', { n: p.dailyGoalXp - xp })}</span></div><ProgressBar value={goalPct} tone="leaf" /></div>

      <WeeklyChallenge compact />
      {/* Conversation practice lives in the Lab; tongue twisters are a bonus round after a unit, and on Profile
          (Leslie, 2026-09-25). */}
      </div>

      <section className="path" aria-label={t('home.path.aria')}>
        <label className="course-pick"><span>{t('home.units.browse')}</span>
          <select value={pathUnit.id} onChange={(e) => setSelected({ course: p.course, unitId: e.target.value })}>
            {COURSE.units.filter((u) => !u.locked && u.lessons.length).map((u, i) => <option key={u.id} value={u.id}>{i + 1}. {unitTitle(u, p.band)} ({u.lessons.filter((l) => p.lessonsCompleted[l.id]).length}/{u.lessons.length})</option>)}
          </select>
        </label>
        <p className="course-overview">{t('home.units.progress', { done: lessons.filter((l) => p.lessonsCompleted[l.id]).length, total: lessons.length })}</p>
        <p className="course-overview" data-curriculum-stage>{stageLabel(pathUnit)}</p>
        <p className="course-overview" data-curriculum-age>{ageGuidance(p.band)}</p>
        <h2 className="section-title">{pathUnit.icon} {unitTitle(pathUnit, p.band)}</h2>
        <p className="course-overview">{unitSubtitle(pathUnit, p.band)}</p>
        <div className="path__bar">
          <div className="chips" role="tablist" aria-label={t('home.path.mode.aria')}>
            <button type="button" role="tab" className={`chip ${!testing ? 'is-on' : ''}`} aria-selected={!testing} onClick={() => setPathMode('learn')}>{t('home.path.mode.learn')}</button>
            <button type="button" role="tab" className={`chip ${testing ? 'is-on' : ''}`} aria-selected={testing} onClick={() => setPathMode('test')}>{t('home.path.mode.test')}</button>
          </div>
          <div className="seg" role="group" aria-label={t('home.path.view.aria')}>
            <button type="button" aria-pressed={pathView === 'map'} aria-label={t('home.path.view.map')} title={t('home.path.view.map')} onClick={() => setPathView('map')}><Icon name="map" size={20} /></button>
            <button type="button" aria-pressed={pathView === 'list'} aria-label={t('home.path.view.list')} title={t('home.path.view.list')} onClick={() => setPathView('list')}><Icon name="list" size={20} /></button>
          </div>
        </div>
        {(() => {
          // One model of the unit's lessons for both views (Leslie, 2026-09-25: the map is a "course alternative" —
          // the list stays). Children follow the path one lesson at a time. Grown-ups may open any lesson; "Up next"
          // still shows the way (Leslie, 2026-09-21: kids in order, grown-ups free).
          const nodes: MapNode[] = pathUnit.lessons.map((l) => {
            const done = p.lessonsCompleted[l.id];
            const unlocked = lessonUnlocked(lessons, l.id, p.band, p.lessonsCompleted);
            const prerequisite = lessons.find((x) => !p.lessonsCompleted[x.id]);
            const current = l.id === nextId;
            if (testing) {
              const can = p.band === 'adult' || !!done;
              const rec = p.tests?.[l.id];
              return {
                id: l.id, icon: can ? l.icon : <Icon name="lock" size={26} />, title: lessonTitle(l),
                sub: rec ? t('home.path.test.best', { n: rec.best }) : can ? t('home.path.test.ready') : t('home.path.test.locked'),
                state: rec ? 'done' : can ? 'open' : 'locked',
                score: rec?.best, mark: !rec && can ? 'play' : undefined,
                onClick: () => nav(`/lesson/${l.id}?mode=test`),
              };
            }
            return {
              id: l.id, icon: unlocked ? l.icon : <Icon name="lock" size={26} />, title: lessonTitle(l),
              sub: done ? t(testDue(p, l.id, ids) ? 'home.path.testDue' : 'home.path.again') : current ? t('home.path.upNext') : unlocked ? t('home.path.ready') : t('home.path.locked', { title: prerequisite ? lessonTitle(prerequisite) : '' }),
              state: done ? 'done' : current ? 'current' : unlocked ? 'open' : 'locked',
              stars: done && p.band !== 'adult' ? done.stars : undefined,
              mark: done && p.band === 'adult' ? 'tick' : current ? 'play' : undefined,
              onClick: () => nav(`/lesson/${l.id}`),
            };
          });
          if (pathView === 'map') return <LessonMap label={t('home.path.aria')} unitIcon={pathUnit.icon} scene={sceneFor(p.band)} nodes={nodes} />;
          return (
            <ol className="path__list">
              {nodes.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`node ${n.state === 'open' ? '' : `node--${n.state}`}`} disabled={n.state === 'locked'} onClick={n.onClick}>
                    <span className="node__icon">{n.icon}</span>
                    <span className="node__text"><b>{n.title}</b><small>{n.sub}</small></span>
                    {n.score !== undefined ? <span className={`chip-score chip-score--${n.score >= 90 ? 'good' : n.score >= 75 ? 'okay' : 'weak'}`}>{n.score}</span>
                      : n.stars !== undefined ? <span className="node__stars" aria-label={tn('home.path.stars.aria', n.stars)}>{'★'.repeat(n.stars)}<i>{'★'.repeat(3 - n.stars)}</i></span>
                      : n.mark === 'tick' ? <span className="node__go node__go--done" aria-label={t('home.path.done.aria')}><Icon name="check" size={16} /></span>
                      : n.mark === 'play' ? <span className="node__go"><Icon name="play" size={16} /></span> : null}
                  </button>
                </li>
              ))}
            </ol>
          );
        })()}
        {/* Units still being written. Nothing a learner does opens them, so no padlock (Leslie asked why they were locked). */}
        {COURSE.units.filter((u) => u.locked || !u.lessons.length).map((u) => (
          <div key={u.id} className="unit-soon"><span className="unit-soon__icon" aria-hidden>{u.icon}</span><span><b>{unitTitle(u, p.band)}</b><small>{unitSubtitle(u, p.band)}</small></span><span className="unit-soon__tag">{t('home.path.soon')}</span></div>
        ))}
      </section>
      </div>
    </div>
  );
}

/** The key of the greeting for this time of day. */
const greeting = (): Key => {
  const h = new Date().getHours();
  return h < 12 ? 'home.greeting.morning' : h < 18 ? 'home.greeting.day' : 'home.greeting.evening';
};
