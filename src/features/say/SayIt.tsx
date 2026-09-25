import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n/useT';
import { localeOf, voice } from '../../speech/voice';
import { useActiveProfile } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { SpeakExercise } from '../speak/SpeakExercise';
import { useBook } from './page';
import { sayItem } from './sayItem';

// "Say it right": one sentence of the page that is open in the learner's book (/say?s=3) — hear it, say it, get corrected — then the
// next. The page itself is on Home ("My book"). The sentence lives in the address, so the phone's back button
// returns to the page.
export function SayIt() {
  const { t } = useT();
  const nav = useNavigate();
  const p = useActiveProfile();
  const { page, scorePage } = useBook(p.id);
  const [params, setParams] = useSearchParams();
  const active = Number(params.get('s'));
  const lines = page?.reading.lines ?? [];
  const items = lines.map((l) => sayItem(l, p));
  const current = page && Number.isInteger(active) ? items[active] : null;
  // Back to the page: undo the step that opened the sentence (so the back button can't land on it again).
  const close = () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : nav('/book', { replace: true }));
  const next = items.findIndex((it, i) => i > active && it);
  // The next sentence's take is made while this one is being said: a learner's own lines are never in the shared
  // cache, so each is generated on request, and a hard one can take the server ten seconds.
  useEffect(() => {
    const it = next > 0 ? items[next] : null;
    if (it) voice.prefetch(it.say ?? it.text, { accent: localeOf(it, p.accent), kind: it.kind, ephemeral: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, next]);

  if (!page || !current) return <Navigate to="/book" replace />;
  return (
    <div className="screen lesson">
      <header className="lesson__bar">
        <button type="button" className="icon-btn" aria-label={t('home.say.back')} onClick={close}><Icon name="back" /></button>
        <span className="lesson__count">{active + 1}/{lines.length}</span>
      </header>
      <div className="lesson__body" key={`${active}:${current.id}`}>
        <SpeakExercise item={current} context="practice" mode="free" continueLabel={t(next > 0 ? 'home.say.next' : 'common.done')}
          onDone={(r) => {
            scorePage(page.id, active, r.best);
            if (next > 0) setParams({ s: String(next) }, { replace: true }); else close();
          }} />
      </div>
    </div>
  );
}
