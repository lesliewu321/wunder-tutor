import { useMemo, useState } from 'react';
import type { Exercise } from '../../domain/types';
import { sameSentence, shuffled } from '../../engine/curriculum';
import { language, itemMeaning, tl, type Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { playCorrect } from '../../ui/sounds';
import { useActiveProfile } from '../../state/store';
import { ItemText } from '../../ui/ItemText';
import { Button, toast } from '../../ui/kit';
import { localeOf, voice } from '../../speech/voice';
import { noSoundMessage } from '../../speech/health';

type Literacy = Extract<Exercise, { type: 'read-choice' | 'arrange' }>;
export function LiteracyExercise({ ex, onDone, test = false }: { ex: Literacy; onDone: (first: boolean) => void; test?: boolean }) {
  const { t } = useT();
  const p = useActiveProfile();
  const [wrong, setWrong] = useState(false);
  const [solved, setSolved] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const options = useMemo(() => ex.type === 'read-choice' ? shuffled(ex.options, ex.id) : [], [ex]);
  const indices = useMemo(() => ex.type === 'arrange' ? shuffled(ex.chunks.map((_, i) => i), ex.id) : [], [ex]);
  const item = ex.type === 'arrange' ? ex.item : ex.passage;
  const chunks = ex.type === 'arrange' ? (p.zhScript === 'hant' ? ex.chunksHant ?? ex.chunks : ex.chunks) : [];
  const target = p.zhScript === 'hant' ? item.zh?.hant ?? item.text : item.text;
  const sentence = picked.map((i) => chunks[i]).join(item.zh ? '' : ' ');
  const hear = () => void voice.speak(item.text, { accent: localeOf(item, p.accent), kind: item.kind }).catch(async (e) => toast(await noSoundMessage(p.band, e), '🔇'));
  // "The evidence is in sentence N: …" — one template per App language; the sentence is the passage's own, in the language
  // being learned and in the learner's script. (The English lines of the two courses read the same, the English
  // course quoting its sentence and the Putonghua course glossing it, so the English line can't carry the translation.)
  const explanation = (): string => {
    if (ex.type !== 'read-choice') return '';
    const n = /^The evidence is in sentence ([12]): /.exec(ex.explanation)?.[1];
    const quoted = /^答案在第.句：(.+)$/su.exec(ex.explanationHant)?.[1];
    if (!n || !quoted || language() === 'zh-Hant') return tl(ex.explanation, ex.explanationHant);
    let sentence = quoted;
    const hant = ex.passage.zh?.hant, at = hant ? hant.indexOf(quoted) : -1;
    if (hant && at >= 0 && p.zhScript === 'hans' && hant.length === ex.passage.text.length) sentence = ex.passage.text.slice(at, at + quoted.length);
    return t(`lesson.evidence.${n}` as Key, { sentence });
  };
  const check = () => {
    if (test) { onDone(sameSentence(sentence, target)); return; }
    if (sameSentence(sentence, target)) { setSolved(true); setMessage(t('lesson.literacy.correct')); }
    else { setWrong(true); setMessage(t('lesson.literacy.retry')); }
  };
  return <div className="choice literacy">
    <div className="choice__stage">
      <h2>{t(ex.type === 'arrange' ? 'lesson.literacy.arrange' : 'lesson.literacy.read')}</h2>
      {ex.type === 'read-choice' ? <>
        <div className="card literacy__passage"><ItemText item={ex.passage} band={p.band} script={p.zhScript} /></div>
        {!test && <button className="pill" type="button" onClick={hear}>{t('lesson.literacy.hear')}</button>}
        <h3>{tl(ex.question, ex.questionHant)}</h3>
        <div className="literacy__options">
          {options.map((o) => <button type="button" className="reply" key={o.id} disabled={solved} onClick={() => {
            if (solved) return;
            if (o.id === ex.answer.id) playCorrect();
            if (test) { onDone(o.id === ex.answer.id); return; }
            if (o.id === ex.answer.id) { setSolved(true); setMessage(explanation()); }
            else { setWrong(true); setMessage(t('lesson.literacy.readAgain')); }
          }}>{o.picture && <span aria-hidden>{o.picture} </span>}<ItemText item={o} band={p.band} script={p.zhScript} /></button>)}
        </div>
      </> : <>
        <p>{t('lesson.literacy.instruction')}</p>
        {!test && <button className="pill" type="button" onClick={hear}>{t('lesson.literacy.hearModel')}</button>}
        <div className="literacy__sentence" aria-label={t('lesson.literacy.yourSentence')} aria-live="polite">
          {picked.length ? picked.map((i, n) => <button type="button" className="pill" disabled={solved} key={i} onClick={() => setPicked((xs) => xs.filter((_, j) => j !== n))}>{chunks[i]}</button>) : <span>{t('lesson.literacy.empty')}</span>}
        </div>
        <div className="literacy__chunks">
          {indices.map((i) => <button type="button" className="pill" key={i} disabled={solved || picked.includes(i)} onClick={() => { setPicked((xs) => [...xs, i]); setMessage(''); }}>{chunks[i]}</button>)}
        </div>
        {!solved && <Button variant="ghost" onClick={() => { setPicked([]); setMessage(''); }}>{t('lesson.literacy.reset')}</Button>}
        {solved && <div className="card literacy__passage"><ItemText item={item} band={p.band} script={p.zhScript} /></div>}
      </>}
      <p role="status">{message}</p>
      {solved && !test && itemMeaning(item) && <p className="prompt__meaning">{itemMeaning(item)}</p>}
    </div>
    <div className="choice__dock">
      {solved ? <Button variant="leaf" size="lg" block onClick={() => onDone(!wrong)}>{t('common.continue')}</Button>
        : ex.type === 'arrange' ? <Button variant="primary" size="lg" block disabled={picked.length !== chunks.length} onClick={check}>{t('lesson.literacy.check')}</Button> : null}
    </div>
  </div>;
}
