import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHealth, type ApiHealth } from '../../speech';
import { courseFor, courseTitle, ITEM_INDEX, lessonTitle, unitSubtitle, unitTitle } from '../../content/course';
import { inScript } from '../../content/zh/script';
import { isLongLabel, phonemeInfo } from '../../content/phonemes';
import { courseLessons, currentUnit, lessonUnlocked } from '../../engine/curriculum';
import { dueItems, itemCourse, nextLessonId } from '../../engine/learning';
import { liveStreak, todayXp } from '../../engine/rewards';
import { focusSound, weakSoundsIn } from '../../intelligence/profile';
import { useActiveProfile, useStore } from '../../state/store';
import type { CourseId } from '../../domain/types';
import type { Key } from '../../i18n';
import { rich, useT } from '../../i18n/useT';
import { Icon } from '../../ui/Icon';
import { Button, ProgressBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';

export function Home() {
  const { t, tn } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const setCourse = useStore((s) => s.setCourse);
  const COURSE = courseFor(p.course);
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
  useEffect(() => { void apiHealth().then(setApi); }, []);
  // Never let simulated scores pass for real ones.
  const practiceMode = api !== null && !api.azure;
  // The Putonghua course keeps its own name beside the English one: written in Simplified, shown in the learner's script.
  const courseLabel: Record<CourseId, string> = { en: t('common.course.en'), zh: '普通话 Putonghua', fr: 'Français', ja: '日本語 Japanese', ko: '한국어 Korean', es: 'Español' };
  // In the same order everywhere; the course on screen is always among them, even if the list was changed elsewhere.
  const myCourses = (Object.keys(courseLabel) as CourseId[]).filter((c) => p.learning.includes(c) || c === p.course);

  return (
    <div className="screen home">
      <header className="home__top">
        <button type="button" className="home__me" onClick={() => nav('/me')} aria-label={t('home.profile.aria')}>
          <span className="home__avatar">{p.avatar}</span>
          <span><small>{t(greeting())}</small><b>{p.name}</b></span>
        </button>
        <div className="home__stats">
          <span className={`stat-pill ${streak ? 'stat-pill--hot' : ''}`} aria-label={t('home.streak.aria', { n: streak })}><Icon name="flame" size={18} fill={!!streak} />{streak}</span>
          <span className="stat-pill stat-pill--xp" aria-label={t('home.xp.aria', { xp, goal: p.dailyGoalXp })}><Icon name="bolt" size={18} fill />{xp}<small>/{p.dailyGoalXp}</small></span>
        </div>
      </header>

      {/* Switching between the learner's own courses — the ones a grown-up chose in Settings (Leslie, 2026-09-21: "even if
          I select only 2 languages in settings, all 4 appear in front page"). One course needs no switch: the card below
          already names it. A dropdown, like the settings rows: side-by-side buttons ran out of room at three. */}
      {myCourses.length > 1 && (
        <label className="course-pick"><span>{t('home.course.aria')}</span>
          <select value={p.course} onChange={(e) => setCourse(e.target.value as CourseId)}>
            {myCourses.map((id) => <option key={id} value={id}>{inScript(courseLabel[id], p.zhScript)}</option>)}
          </select>
        </label>
      )}

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
          <p>{next ? rich(t('home.hero.next', { title: `${next.icon} ${lessonTitle(next)}` })) : due ? tn('home.hero.due', due) : t('home.hero.finished')}</p>
          <div className="hero__progress"><ProgressBar value={doneCount / ids.length} tone="sun" /><span>{doneCount}/{ids.length}</span></div>
        </div>
        <Mascot mood="happy" size={104} className="hero__pip" />
        <Button variant="coral" size="lg" block onClick={() => nav(`/lesson/${next?.id ?? review.id}`)}>{t(doneCount === 0 ? 'home.hero.start' : next ? 'home.hero.continue' : 'home.hero.review')}</Button>
      </section>

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

      <button type="button" className="row-link" onClick={() => nav('/speak')}>
        <span className="row-link__icon"><Icon name="chat" /></span>
        <span><b>{t(p.band === 'adult' ? 'home.talk.title.adult' : 'home.talk.title.kid')}</b><small>{t('home.talk.sub')}</small></span>
        <Icon name="chevron" size={20} />
      </button>
      </div>

      <section className="path" aria-label={t('home.path.aria')}>
        <label className="course-pick"><span>{t('home.units.browse')}</span>
          <select value={pathUnit.id} onChange={(e) => setSelected({ course: p.course, unitId: e.target.value })}>
            {COURSE.units.filter((u) => !u.locked && u.lessons.length).map((u, i) => <option key={u.id} value={u.id}>{i + 1}. {unitTitle(u, p.band)} ({u.lessons.filter((l) => p.lessonsCompleted[l.id]).length}/{u.lessons.length})</option>)}
          </select>
        </label>
        <p className="course-overview">{t('home.units.progress', { done: lessons.filter((l) => p.lessonsCompleted[l.id]).length, total: lessons.length })}</p>
        <h2 className="section-title">{pathUnit.icon} {unitTitle(pathUnit, p.band)}</h2>
        <p className="course-overview">{unitSubtitle(pathUnit, p.band)}</p>
        <div className="chips" role="tablist" aria-label={t('home.path.mode.aria')}>
          <button type="button" role="tab" className={`chip ${!testing ? 'is-on' : ''}`} aria-selected={!testing} onClick={() => setPathMode('learn')}>{t('home.path.mode.learn')}</button>
          <button type="button" role="tab" className={`chip ${testing ? 'is-on' : ''}`} aria-selected={testing} onClick={() => setPathMode('test')}>{t('home.path.mode.test')}</button>
        </div>
        <ol className="path__list">
          {pathUnit.lessons.map((l) => {
            const done = p.lessonsCompleted[l.id];
            // Children follow the path one lesson at a time. Grown-ups may open any lesson; "Up next" still shows the way
            // (Leslie, 2026-09-21: kids in order, grown-ups free).
            const unlocked = lessonUnlocked(lessons, l.id, p.band, p.lessonsCompleted);
            const prerequisite = lessons.find((x) => !p.lessonsCompleted[x.id]);
            const current = l.id === nextId;
            if (testing) {
              const can = p.band === 'adult' || !!done;
              const rec = p.tests?.[l.id];
              return (
                <li key={l.id}>
                  <button type="button" className={`node ${rec ? 'node--done' : can ? '' : 'node--locked'}`} disabled={!can} onClick={() => nav(`/lesson/${l.id}?mode=test`)}>
                    <span className="node__icon">{can ? l.icon : <Icon name="lock" size={22} />}</span>
                    <span className="node__text"><b>{lessonTitle(l)}</b><small>{rec ? t('home.path.test.best', { n: rec.best }) : can ? t('home.path.test.ready') : t('home.path.test.locked')}</small></span>
                    {rec ? <span className={`chip-score chip-score--${rec.best >= 90 ? 'good' : rec.best >= 75 ? 'okay' : 'weak'}`}>{rec.best}</span> : can ? <span className="node__go"><Icon name="play" size={16} /></span> : null}
                  </button>
                </li>
              );
            }
            return (
              <li key={l.id}>
                <button type="button" className={`node ${done ? 'node--done' : current ? 'node--current' : unlocked ? '' : 'node--locked'}`} disabled={!unlocked} onClick={() => nav(`/lesson/${l.id}`)}>
                  <span className="node__icon">{unlocked ? l.icon : <Icon name="lock" size={22} />}</span>
                  <span className="node__text"><b>{lessonTitle(l)}</b><small>{done ? t('home.path.again') : current ? t('home.path.upNext') : unlocked ? t('home.path.ready') : t('home.path.locked', { title: prerequisite ? lessonTitle(prerequisite) : '' })}</small></span>
                  {done ? p.band === 'adult' ? <span className="node__go node__go--done" aria-label={t('home.path.done.aria')}><Icon name="check" size={16} /></span> : <span className="node__stars" aria-label={tn('home.path.stars.aria', done.stars)}>{'★'.repeat(done.stars)}<i>{'★'.repeat(3 - done.stars)}</i></span> : current ? <span className="node__go"><Icon name="play" size={16} /></span> : null}
                </button>
              </li>
            );
          })}
        </ol>
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
