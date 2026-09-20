import { useNavigate } from 'react-router-dom';
import { ALL_LESSONS } from '../../content/course';
import { LADDERS } from '../../content/lab';
import { isLongLabel, phonemeInfo } from '../../content/phonemes';
import { ACHIEVEMENT_CATALOGUE, badgeDetail, badgeName, liveStreak } from '../../engine/rewards';
import { rich, useT } from '../../i18n/useT';
import { improvementSummary, improvingSounds, masteredSounds, totals, trend, weakSounds, type TrendPoint } from '../../intelligence/profile';
import { useActiveProfile } from '../../state/store';
import { tier } from '../../tutor/feedback';
import { Button, TopBar } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';

export function Progress() {
  const { t } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const minutes = (ms: number) => (ms < 60000 ? t('progress.stat.speaking.seconds', { n: Math.round(ms / 1000) }) : t('progress.stat.speaking.minutes', { n: Math.round(ms / 60000) }));
  const sums = totals(p.pronunciation);
  const points = trend(p.pronunciation, 30);
  const summary = improvementSummary(p.pronunciation);
  const weak = weakSounds(p.pronunciation).filter((s) => phonemeInfo(s.phoneme).difficulty >= 0.3).slice(0, 4);
  const mastered = masteredSounds(p.pronunciation);
  const improving = improvingSounds(p.pronunciation).slice(0, 3);
  const bests = Object.values(p.pronunciation.words).filter((w) => w.attempts >= 1 && w.word.length > 2).sort((a, b) => b.best - a.best).slice(0, 4);
  const lessons = Object.keys(p.lessonsCompleted).length;
  const today = points[points.length - 1];

  if (sums.attempts === 0) {
    return (
      <div className="screen progress">
        <TopBar title={t('progress.title')} />
        <div className="empty"><Mascot mood="idle" size={120} /><h2>{t('progress.empty.title')}</h2><p>{t(p.band === 'adult' ? 'progress.empty.body.adult' : 'progress.empty.body.kid')}</p><Button variant="coral" size="lg" onClick={() => nav('/')}>{t('progress.empty.start')}</Button></div>
      </div>
    );
  }

  return (
    <div className="screen progress">
      <TopBar title={t('progress.title')} />

      <section className="card trend">
        <div className="trend__head">
          <div><small>{t('progress.trend.label')}</small><b className={`score-text score-text--${tier(today.avg)}`}>{today.avg}</b></div>
          <p>{summary
            ? summary.to > summary.from ? rich(t('progress.trend.up', { from: summary.from, to: summary.to })) : rich(t('progress.trend.steady', { to: summary.to }))
            : t('progress.trend.first')}</p>
        </div>
        <TrendChart points={points} />
      </section>

      <div className="stat-grid">
        <div className="stat"><b>{lessons}</b><span>{t('progress.stat.lessons', { total: ALL_LESSONS.length })}</span></div>
        <div className="stat stat--coral"><b>{minutes(sums.speakingMs)}</b><span>{t('progress.stat.speaking')}</span></div>
        <div className="stat stat--leaf"><b>{sums.wordsLearned}</b><span>{t('progress.stat.words')}</span></div>
        <div className="stat stat--sun"><b>{Math.max(liveStreak(p.streak), 0)}</b><span>{t('progress.stat.streak', { best: p.streak.best })}</span></div>
      </div>

      <section>
        <h2 className="section-title">{t('progress.weak.title')}</h2>
        {weak.length ? (
          <ul className="sound-rows">
            {weak.map((s) => {
              const info = phonemeInfo(s.phoneme);
              const sub = Object.entries(s.heardAs).sort((a, b) => b[1] - a[1])[0]?.[0];
              return (
                <li key={s.phoneme}>
                  <button type="button" className="sound-row" onClick={() => nav(LADDERS[s.phoneme] ? `/lab/${encodeURIComponent(s.phoneme)}` : '/lab')}>
                    <span className="sound-row__glyph sound-row__glyph--weak" data-long={isLongLabel(info.label) || undefined}>{info.label}</span>
                    <span className="sound-row__text"><b>{info.name}</b><small>{sub && sub !== '∅' ? t('progress.weak.heardAs', { label: phonemeInfo(sub).label, n: s.count }) : t('progress.weak.example', { example: info.example, n: s.count })}</small></span>
                    <span className="meter"><i style={{ width: `${s.ema}%` }} className={`meter--${tier(s.ema)}`} /></span>
                    <b className={`score-text score-text--${tier(s.ema)}`}>{Math.round(s.ema)}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="muted-card">{p.band === 'adult' ? t('progress.weak.none.adult') : `${t('progress.weak.none.kid')} 👂`}</p>}
      </section>

      {improving.length > 0 && (
        <section>
          <h2 className="section-title">{t('progress.improving.title')}</h2>
          <ul className="gains">{improving.map((s) => <li key={s.phoneme}><span className="gains__glyph" data-long={isLongLabel(phonemeInfo(s.phoneme).label) || undefined}>{phonemeInfo(s.phoneme).label}</span><span>{Math.round(s.first)} → <b>{Math.round(s.ema)}</b></span><em>+{s.gain}</em></li>)}</ul>
        </section>
      )}

      <section>
        <h2 className="section-title">{t('progress.mastered.title')}</h2>
        {mastered.length ? <div className="badges">{mastered.map((s) => <span key={s.phoneme} className="sound-badge sound-badge--good"><b>{phonemeInfo(s.phoneme).label}</b><small>{phonemeInfo(s.phoneme).example}</small></span>)}</div>
          : <p className="muted-card">{t('progress.mastered.none')}</p>}
      </section>

      {bests.length > 0 && (
        <section>
          <h2 className="section-title">{t('progress.bests.title')}</h2>
          <ul className="bests">{bests.map((w) => <li key={w.word}><span>{w.word}</span><b className={`score-text score-text--${tier(w.best)}`}>{w.best}</b></li>)}</ul>
        </section>
      )}

      <section>
        <h2 className="section-title">{t('progress.badges.title')}</h2>
        <div className="trophies">
          {ACHIEVEMENT_CATALOGUE.map((a) => {
            const got = p.achievements.find((x) => x.id === a.id);
            return <div key={a.id} className={`trophy ${got ? 'is-on' : ''}`} title={badgeDetail(a)}><span>{got ? a.icon : '🔒'}</span><small>{badgeName(a)}</small></div>;
          })}
        </div>
      </section>
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const { t } = useT();
  const W = 320, H = 110, pad = 14;
  if (points.length < 2) {
    return <div className="trend__single"><div className="trend__dot" style={{ bottom: `${points[0].avg * 0.7}%` }} /><span>{t('progress.trend.day1')}</span></div>;
  }
  const lo = Math.max(0, Math.min(...points.map((p) => p.avg)) - 10);
  const hi = Math.min(100, Math.max(...points.map((p) => p.avg)) + 8);
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(' ');
  return (
    <svg className="trend__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('progress.trend.chart', { from: points[0].avg, to: points[points.length - 1].avg })}>
      <path d={`${d} L ${x(points.length - 1)} ${H - pad} L ${x(0)} ${H - pad} Z`} fill="var(--primary-soft)" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.avg)} r={i === points.length - 1 ? 6 : 3.5} fill="var(--surface)" stroke="var(--primary)" strokeWidth="3" />)}
    </svg>
  );
}
