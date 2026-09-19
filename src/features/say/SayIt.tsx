import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHealth, type ApiHealth } from '../../speech';
import { prepareText, readPhoto, ReadError, splitSentences, type ReadLine, type Reading } from '../../speech/read';
import { useActiveProfile } from '../../state/store';
import { tier } from '../../tutor/feedback';
import { Icon } from '../../ui/Icon';
import { Button, TopBar, toast } from '../../ui/kit';
import { ZhText } from '../../ui/ZhText';
import { SpeakExercise } from '../speak/SpeakExercise';
import { sayItem } from './sayItem';

// "Say it right": type or photograph any text — a page of a book, a menu, a sign — then hear it, say it and get
// corrected, one sentence at a time. English typed text is split on the device; photos and Chinese text are read
// by the server (Gemini), which also gives Chinese the Simplified characters and the pinyin the checks need.

const HAN = /\p{Script=Han}/u;
const ERRORS: Record<ReadError['code'], string> = {
  offline: 'No internet right now — try again when you’re back online.',
  busy: 'That was a lot of pages! Wait a few minutes, then try again.',
  unavailable: 'Reading photos needs real scoring switched on (Settings & privacy → Beta access).',
  failed: 'The text couldn’t be read this time. Try again, or type it in.',
};

export function SayIt() {
  const nav = useNavigate();
  const p = useActiveProfile();
  const kid = p.band === 'little' || p.band === 'junior';
  const [api, setApi] = useState<ApiHealth | null>(null);
  const [text, setText] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState<'photo' | 'text' | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [best, setBest] = useState<Record<number, number>>({});
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  useEffect(() => { void apiHealth().then(setApi); }, []);

  const show = (r: Reading) => {
    if (r.language === 'none' || !r.lines.length) return toast(kid ? 'I couldn’t find any words — try a closer, brighter photo' : 'No text found — try a closer, brighter photo', '🔍');
    if (r.language === 'other') return toast('Wunder Tutor can check English and Putonghua for now', '🌏');
    setReading(r);
    setText(r.lines.map((l) => l.text).join('\n'));
    setBest({});
    setActive(null);
  };
  const run = async (kind: 'photo' | 'text', job: () => Promise<Reading>) => {
    setBusy(kind);
    try { show(await job()); } catch (e) { toast(ERRORS[e instanceof ReadError ? e.code : 'failed'], '⚠️'); } finally { setBusy(null); }
  };
  const onPhoto = (file?: File) => { if (file) void run('photo', () => readPhoto(file)); };
  const onText = () => {
    const t = text.trim();
    if (!t) return;
    // English needs no server; Chinese needs the server for pinyin.
    if (!HAN.test(t)) show({ language: 'en', lines: splitSentences(t).map((s) => ({ text: s })) });
    else void run('text', () => prepareText(t));
  };

  const lines = reading?.lines ?? [];
  const items = lines.map((l) => sayItem(l, p));
  const current = active != null ? items[active] : null;

  if (current && active != null) {
    const next = items.findIndex((it, i) => i > active && it);
    return (
      <div className="screen lesson">
        <header className="lesson__bar">
          <button type="button" className="icon-btn" aria-label="Back to the sentences" onClick={() => setActive(null)}><Icon name="back" /></button>
          <span className="lesson__count">{active + 1}/{lines.length}</span>
        </header>
        <div className="lesson__body" key={`${active}:${current.id}`}>
          <SpeakExercise item={current} context="practice" mode="free" continueLabel={next > 0 ? 'Next sentence' : 'Done'}
            onDone={(r) => { setBest((b) => ({ ...b, [active]: Math.max(b[active] ?? 0, r.best) })); setActive(next > 0 ? next : null); }} />
        </div>
      </div>
    );
  }

  const readsPhotos = api?.read ?? false;
  return (
    <div className="screen say">
      <TopBar title="Say it right" onBack={() => nav('/speak')} />
      <p className="lead">{kid ? 'Snap a page from your book — or type some words — then say it like the teacher!' : 'Type or photograph any text — a page of a book, a menu, a sign. Hear how it sounds, say it, and get help.'}</p>

      <section className="card say__input">
        <label className="sr-only" htmlFor="say-text">Text to practise</label>
        <textarea id="say-text" className="input say__text" rows={4} value={text} maxLength={2000} placeholder={kid ? 'Type some words…' : 'Type or paste a sentence…'}
          onChange={(e) => { setText(e.target.value); setReading(null); }} />
        <div className="say__actions">
          <Button variant="soft" icon="camera" disabled={!!busy || !readsPhotos} onClick={() => camera.current?.click()}>Take a photo</Button>
          <Button variant="soft" icon="image" disabled={!!busy || !readsPhotos} onClick={() => library.current?.click()}>Choose a photo</Button>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={library} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <Button variant="primary" size="lg" block disabled={!text.trim() || !!busy} onClick={onText}>
          {busy === 'photo' ? 'Reading your photo…' : busy === 'text' ? 'Getting it ready…' : 'Practise this text'}
        </Button>
        {api && !readsPhotos && <p className="hint hint--left">Photos and Chinese text need real scoring switched on ({p.band === 'adult' ? 'Settings & privacy' : 'a grown-up can do this in the Parent Zone'} → Beta access). Typed English works now.</p>}
        {readsPhotos && <p className="fineprint fineprint--left">Photos are read by Google’s Gemini to find the words, then discarded — nothing is kept.</p>}
      </section>

      {lines.length > 0 && (
        <section>
          <h2 className="section-title">{kid ? 'Pick a sentence to say' : 'Sentences'}</h2>
          <ol className="say__lines">
            {lines.map((l: ReadLine, i) => {
              const it = items[i];
              return (
                <li key={i}>
                  <button type="button" className="say__line" disabled={!it} onClick={() => setActive(i)}>
                    <span className="say__line-text">{it?.zh ? <ZhText item={it} script={p.zhScript} /> : l.text}</span>
                    {!it ? <small>Can’t check this line</small> : best[i] != null ? <span className={`chip-score chip-score--${tier(best[i])}`}>{best[i]}</span> : <Icon name="mic" size={20} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
