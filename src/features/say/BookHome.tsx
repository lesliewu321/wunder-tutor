import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGrownUp, type ChildProfile } from '../../domain/types';
import { useT } from '../../i18n/useT';
import { apiHealth, getAccessCode, type ApiHealth } from '../../speech/health';
import { prepareText, splitSentences, type Reading } from '../../speech/read';
import { tier } from '../../tutor/feedback';
import { Icon } from '../../ui/Icon';
import { Button, Sheet, toast } from '../../ui/kit';
import { ZhText } from '../../ui/ZhText';
import { openCamera } from './camera';
import { bookNotice, readProblem, readingProblem } from './messages';
import { useBook } from './page';
import { sayItem } from './sayItem';

// Home's second mode, "My book": the page the learner photographed, one sentence at a time. Before the first photo it
// is one big camera button. Typing is the quiet alternative (English typed text is split here and works without the
// API; Chinese goes to the server for its pinyin).

const HAN = /\p{Script=Han}/u;

export function BookHome({ p }: { p: ChildProfile }) {
  const { t, tn } = useT();
  const nav = useNavigate();
  const kid = !isGrownUp(p.band);
  const { page, setPage } = useBook(p.id);
  const [api, setApi] = useState<ApiHealth | null>(null);
  const [typing, setTyping] = useState(false);
  useEffect(() => { void apiHealth().then(setApi); }, []);

  const lines = page?.reading.lines ?? [];
  const items = lines.map((l) => sayItem(l, p));
  const best = page?.best ?? {};
  const open = items.flatMap((it, i) => (it ? [i] : []));
  const said = open.filter((i) => best[i] != null).length;
  const next = open.find((i) => best[i] == null) ?? open[0];
  const settings = t(p.band === 'adult' ? 'common.settings.adult' : 'common.settings.parent.the');
  // Says what is actually wrong: no code, a code that stopped working, or a server that can't read yet.
  const notice = api ? bookNotice(api, !!getAccessCode(), kid, settings) : null;

  return (
    <div className="book">
      {notice && <p className="practice-note" role="note"><span aria-hidden>🔒</span><span>{notice}</span></p>}

      {!page ? (
        <section className="book__start">
          <span className="book__art" aria-hidden>📖</span>
          <h1>{t(kid ? 'home.book.start.title.kid' : 'home.book.start.title.adult')}</h1>
          <p>{t(kid ? 'home.book.start.body.kid' : 'home.book.start.body.adult')}</p>
          <Button variant="coral" size="lg" block icon="camera" onClick={openCamera}>{t('home.book.takePhoto')}</Button>
        </section>
      ) : (
        <section className="book__page">
          <div className="book__head">
            <div>
              <h1>{t(kid ? 'home.book.page.title.kid' : 'home.book.page.title.adult')}</h1>
              <p>{open.length ? tn('home.book.page.said', open.length, { said }) : t('home.book.page.nothing')}</p>
            </div>
            <Button variant="soft" size="sm" icon="camera" onClick={openCamera}>{t('home.book.newPhoto')}</Button>
          </div>
          {next != null && (
            <Button variant="coral" size="lg" block onClick={() => nav(`/say?s=${next}`)}>
              {t(said === 0 ? (kid ? 'home.book.go.start.kid' : 'home.book.go.start.adult') : said < open.length ? 'home.book.go.keep' : 'home.book.go.again')}
            </Button>
          )}
          <ol className="say__lines">
            {lines.map((l, i) => {
              const it = items[i];
              return (
                <li key={i}>
                  <button type="button" className="say__line" disabled={!it} onClick={() => nav(`/say?s=${i}`)}>
                    <span className="say__line-text">{it?.zh ? <ZhText item={it} script={p.zhScript} /> : l.text}</span>
                    {!it ? <small>{t(l.lang === 'other' ? 'home.book.line.other' : 'home.book.line.cant')}</small>
                      : best[i] != null ? <span className={`chip-score chip-score--${tier(best[i])}`}>{best[i]}</span> : <Icon name="mic" size={20} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <button type="button" className="book__type" onClick={() => setTyping(true)}><Icon name="keyboard" size={18} />{t(kid ? 'home.book.type.kid' : 'home.book.type.adult')}</button>
      {api?.read && <p className="fineprint">{t('home.book.fineprint')}</p>}
      <TypeSheet open={typing} kid={kid} onClose={() => setTyping(false)} onReady={(reading) => { setPage({ reading, best: {}, at: Date.now() }); setTyping(false); }} />
    </div>
  );
}

function TypeSheet({ open, kid, onClose, onReady }: { open: boolean; kid: boolean; onClose: () => void; onReady: (r: Reading) => void }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const typed = text.trim();
    if (!typed) return;
    // English needs no server; Chinese needs the server for its pinyin.
    if (!HAN.test(typed)) return onReady({ language: 'en', lines: splitSentences(typed).map((s) => ({ text: s, lang: 'en' as const })) });
    setBusy(true);
    try {
      const r = await prepareText(typed);
      const problem = readingProblem(r, kid);
      if (problem) toast(problem, '🔍'); else { onReady(r); setText(''); }
    } catch (e) {
      toast(readProblem(e).text, '⚠️');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} label={t('home.book.typeSheet.aria')}>
      <div className="type-sheet">
        <h2>{t(kid ? 'home.book.typeSheet.title.kid' : 'home.book.typeSheet.title.adult')}</h2>
        <label className="sr-only" htmlFor="say-text">{t('home.book.typeSheet.field')}</label>
        <textarea id="say-text" className="input say__text" rows={5} value={text} maxLength={2000} placeholder={t(kid ? 'home.book.typeSheet.placeholder.kid' : 'home.book.typeSheet.placeholder.adult')} onChange={(e) => setText(e.target.value)} />
        <Button variant="primary" size="lg" block disabled={!text.trim() || busy} onClick={() => void go()}>{t(busy ? 'home.book.typeSheet.busy' : 'home.book.typeSheet.go')}</Button>
      </div>
    </Sheet>
  );
}
