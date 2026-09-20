import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGrownUp, type ChildProfile } from '../../domain/types';
import { apiHealth, type ApiHealth } from '../../speech/health';
import { prepareText, splitSentences, type Reading } from '../../speech/read';
import { tier } from '../../tutor/feedback';
import { Icon } from '../../ui/Icon';
import { Button, Sheet, toast } from '../../ui/kit';
import { ZhText } from '../../ui/ZhText';
import { openCamera } from './camera';
import { readProblem, readingProblem } from './messages';
import { useBook } from './page';
import { sayItem } from './sayItem';

// Home's second mode, "My book": the page the learner photographed, one sentence at a time. Before the first photo it
// is one big camera button. Typing is the quiet alternative (English typed text is split here and works without the
// API; Chinese goes to the server for its pinyin).

const HAN = /\p{Script=Han}/u;

export function BookHome({ p }: { p: ChildProfile }) {
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
  const settings = p.band === 'adult' ? 'Settings & privacy' : 'the Parent Zone';

  return (
    <div className="book">
      {api && !api.read && (
        <p className="practice-note" role="note"><span aria-hidden>🔒</span><span><b>Photos need the beta access code.</b> {kid ? 'A grown-up can add it' : 'Add it'} in {settings} → Beta access. Typed English works without it.</span></p>
      )}

      {!page ? (
        <section className="book__start">
          <span className="book__art" aria-hidden>📖</span>
          <h1>{kid ? 'Snap a page from your book' : 'Practise any page'}</h1>
          <p>{kid ? 'Take a photo. Listen to each sentence, say it, and get help with every word.' : 'Photograph a page of a book, a menu or a sign. Hear each sentence, say it, and get corrected.'}</p>
          <Button variant="coral" size="lg" block icon="camera" onClick={openCamera}>Take a photo</Button>
        </section>
      ) : (
        <section className="book__page">
          <div className="book__head">
            <div>
              <h1>{kid ? 'My page' : 'Your page'}</h1>
              <p>{open.length ? `${said} of ${open.length} sentences said` : 'Nothing here can be checked yet'}</p>
            </div>
            <Button variant="soft" size="sm" icon="camera" onClick={openCamera}>New photo</Button>
          </div>
          {next != null && (
            <Button variant="coral" size="lg" block onClick={() => nav(`/say?s=${next}`)}>
              {said === 0 ? (kid ? 'Start reading' : 'Start') : said < open.length ? 'Keep going' : 'Practise again'}
            </Button>
          )}
          <ol className="say__lines">
            {lines.map((l, i) => {
              const it = items[i];
              return (
                <li key={i}>
                  <button type="button" className="say__line" disabled={!it} onClick={() => nav(`/say?s=${i}`)}>
                    <span className="say__line-text">{it?.zh ? <ZhText item={it} script={p.zhScript} /> : l.text}</span>
                    {!it ? <small>{l.lang === 'other' ? 'Not English or Putonghua' : 'Can’t check this line'}</small>
                      : best[i] != null ? <span className={`chip-score chip-score--${tier(best[i])}`}>{best[i]}</span> : <Icon name="mic" size={20} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <button type="button" className="book__type" onClick={() => setTyping(true)}><Icon name="keyboard" size={18} />{kid ? 'Type the words instead' : 'Type or paste text instead'}</button>
      {api?.read && <p className="fineprint">Photos and sentences go to Google’s Gemini to be read and spoken. Wunder Tutor doesn’t keep them; Google may keep them for a short time under its API terms.</p>}
      <TypeSheet open={typing} kid={kid} onClose={() => setTyping(false)} onReady={(reading) => { setPage({ reading, best: {}, at: Date.now() }); setTyping(false); }} />
    </div>
  );
}

function TypeSheet({ open, kid, onClose, onReady }: { open: boolean; kid: boolean; onClose: () => void; onReady: (r: Reading) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const t = text.trim();
    if (!t) return;
    // English needs no server; Chinese needs the server for its pinyin.
    if (!HAN.test(t)) return onReady({ language: 'en', lines: splitSentences(t).map((s) => ({ text: s, lang: 'en' as const })) });
    setBusy(true);
    try {
      const r = await prepareText(t);
      const problem = readingProblem(r, kid);
      if (problem) toast(problem, '🔍'); else { onReady(r); setText(''); }
    } catch (e) {
      toast(readProblem(e).text, '⚠️');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Type the words">
      <div className="type-sheet">
        <h2>{kid ? 'Type the words' : 'Type or paste text'}</h2>
        <label className="sr-only" htmlFor="say-text">Text to practise</label>
        <textarea id="say-text" className="input say__text" rows={5} value={text} maxLength={2000} placeholder={kid ? 'Type some words…' : 'Type or paste a sentence…'} onChange={(e) => setText(e.target.value)} />
        <Button variant="primary" size="lg" block disabled={!text.trim() || busy} onClick={() => void go()}>{busy ? 'Getting it ready…' : 'Practise this text'}</Button>
      </div>
    </Sheet>
  );
}
