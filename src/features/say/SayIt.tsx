import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  unavailable: 'Reading photos needs real scoring switched on (Beta access).',
  photo: 'That photo couldn’t be opened. Take a new one, or choose a JPEG or PNG.',
  failed: 'The text couldn’t be read this time. Try again, or type it in.',
};

/** The page being practised survives leaving the screen (the phone's back button, a quick look elsewhere). */
const SAVED = 'wunder-tutor/say';
interface Saved { text: string; reading: Reading | null; best: Record<number, number> }
const load = (): Saved => { try { return { text: '', reading: null, best: {}, ...JSON.parse(sessionStorage.getItem(SAVED) ?? '{}') }; } catch { return { text: '', reading: null, best: {} }; } };
const save = (s: Saved) => { try { sessionStorage.setItem(SAVED, JSON.stringify(s)); } catch { /* private mode: this visit only */ } };

/** A phone or tablet: offer the camera. A computer: choosing a file is the camera button's job anyway. */
const hasCamera = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function SayIt() {
  const nav = useNavigate();
  const p = useActiveProfile();
  const kid = p.band === 'little' || p.band === 'junior';
  const [params, setParams] = useSearchParams();
  const [api, setApi] = useState<ApiHealth | null>(null);
  const [initial] = useState(load);
  const [text, setText] = useState(initial.text);
  const [reading, setReading] = useState<Reading | null>(initial.reading);
  const [best, setBest] = useState<Record<number, number>>(initial.best);
  const [busy, setBusy] = useState<'photo' | 'text' | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  useEffect(() => { void apiHealth().then(setApi); }, []);
  useEffect(() => save({ text, reading, best }), [text, reading, best]);

  // The sentence being practised lives in the address (?s=3), so the back button returns to the list.
  const active = params.has('s') ? Number(params.get('s')) : null;
  const open = (i: number) => setParams({ s: String(i) }, { replace: active != null });
  // Back to the list: undo the step that opened the sentence (so the back button can't land on it again).
  const close = () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : setParams({}, { replace: true }));

  const show = (r: Reading) => {
    if (r.language === 'none' || !r.lines.length) return toast(kid ? 'I couldn’t find any words — try a closer, brighter photo' : 'No text found — try a closer, brighter photo', '🔍');
    if (r.language === 'other') return toast('Wunder Tutor can check English and Putonghua for now', '🌏');
    setReading(r);
    setText(r.lines.map((l) => l.text).join('\n'));
    setBest({});
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
  const current = active != null && Number.isInteger(active) ? items[active] : null;

  if (current && active != null) {
    const next = items.findIndex((it, i) => i > active && it);
    return (
      <div className="screen lesson">
        <header className="lesson__bar">
          <button type="button" className="icon-btn" aria-label="Back to the sentences" onClick={close}><Icon name="back" /></button>
          <span className="lesson__count">{active + 1}/{lines.length}</span>
        </header>
        <div className="lesson__body" key={`${active}:${current.id}`}>
          <SpeakExercise item={current} context="practice" mode="free" continueLabel={next > 0 ? 'Next sentence' : 'Done'}
            onDone={(r) => { setBest((b) => ({ ...b, [active]: Math.max(b[active] ?? 0, r.best) })); if (next > 0) open(next); else close(); }} />
        </div>
      </div>
    );
  }

  const readsPhotos = api?.read ?? false;
  const realScores = api?.azure ?? false;
  const settings = p.band === 'adult' ? 'Settings & privacy' : 'the Parent Zone';
  return (
    <div className="screen say">
      <TopBar title="Say it right" onBack={() => nav('/speak')} />
      <p className="lead">{kid ? 'Snap a page from your book — or type some words — then say it like the teacher!' : 'Type or photograph any text — a page of a book, a menu, a sign. Hear how it sounds, say it, and get help.'}</p>

      {api && !realScores && (
        <p className="practice-note" role="note"><span aria-hidden>🧪</span><span><b>Practice mode — scores are simulated.</b> Real scoring, photos and Chinese text need the beta access code ({settings} → Beta access).</span></p>
      )}

      <section className="card say__input">
        <label className="sr-only" htmlFor="say-text">Text to practise</label>
        <textarea id="say-text" className="input say__text" rows={4} value={text} maxLength={2000} placeholder={kid ? 'Type some words…' : 'Type or paste a sentence…'}
          onChange={(e) => { setText(e.target.value); setReading(null); }} />
        <div className={`say__actions ${hasCamera() ? '' : 'say__actions--one'}`}>
          {hasCamera() && <Button variant="soft" icon="camera" disabled={!!busy || !readsPhotos} onClick={() => camera.current?.click()}>Take a photo</Button>}
          <Button variant="soft" icon="image" disabled={!!busy || !readsPhotos} onClick={() => library.current?.click()}>Choose a photo</Button>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={library} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <Button variant="primary" size="lg" block disabled={!text.trim() || !!busy} onClick={onText}>
          {busy === 'photo' ? 'Reading your photo…' : busy === 'text' ? 'Getting it ready…' : 'Practise this text'}
        </Button>
        {readsPhotos && <p className="fineprint fineprint--left">Photos and sentences go to Google’s Gemini to read the words and speak them. Wunder Tutor doesn’t keep them; Google may keep them for a short time under its API terms.</p>}
      </section>

      {lines.length > 0 && (
        <section>
          <h2 className="section-title">{kid ? 'Pick a sentence to say' : 'Sentences'}</h2>
          <ol className="say__lines">
            {lines.map((l: ReadLine, i) => {
              const it = items[i];
              return (
                <li key={i}>
                  <button type="button" className="say__line" disabled={!it} onClick={() => open(i)}>
                    <span className="say__line-text">{it?.zh ? <ZhText item={it} script={p.zhScript} /> : l.text}</span>
                    {!it ? <small>{l.lang === 'other' ? 'Not English or Putonghua' : 'Can’t check this line'}</small> : best[i] != null ? <span className={`chip-score chip-score--${tier(best[i])}`}>{best[i]}</span> : <Icon name="mic" size={20} />}
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
