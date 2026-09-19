import { useState } from 'react';
import type { AgeBand, HomeLanguage, WordScore } from '../../domain/types';
import { phonemeInfo } from '../../content/phonemes';
import { correctionFor, tier } from '../../tutor/feedback';
import { Button, Sheet } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { Mouth } from '../../ui/Mouth';

interface Props {
  word: WordScore;
  band: AgeBand;
  home?: HomeLanguage;
  onClose: () => void;
  onListen: (slow: boolean) => void;
  onHearMe: () => void;
  onHearTip: (text: string) => void;
  onRetry?: () => void;
}

/** Diagnose → teach for a single word: the exact sound, what happened, what to do with your mouth. */
export function WordSheet({ word, band, home, onClose, onListen, onHearMe, onHearTip, onRetry }: Props) {
  const [more, setMore] = useState(false);
  const c = correctionFor(word, band, home);
  const info = c.phoneme ? phonemeInfo(c.phoneme) : null;

  return (
    <Sheet open onClose={onClose} label={`Help with the word ${word.word}`}>
      <div className="wordsheet">
        <div className="wordsheet__head">
          <h2 className="wordsheet__word">{word.word}</h2>
          <span className={`chip-score chip-score--${tier(word.score)}`}>{word.errorType === 'omission' ? 'missed' : word.score}</span>
        </div>

        {word.phonemes.length > 0 && (
          <div className="sounds" aria-label="Sounds in this word">
            {word.phonemes.map((p, i) => (
              <span key={i} className={`sound sound--${tier(p.score)} ${p.phoneme === c.phoneme ? 'sound--focus' : ''}`}>
                <b>{band === 'teen' ? `/${p.phoneme}/` : phonemeInfo(p.phoneme).label}</b><small>{p.score}</small>
              </span>
            ))}
          </div>
        )}

        <div className="teach">
          <p className="teach__problem">{c.problem}</p>
          <div className="teach__row">
            {info && c.kind === 'sound' && <div className="teach__mouth"><Mouth pose={info.pose} size={132} /></div>}
            <p className="teach__tip"><b>Try:</b> {c.tip}</p>
          </div>
          <button type="button" className="teach__say" onClick={() => onHearTip(c.tip)}><Icon name="speaker" size={18} />Hear Pip say the tip</button>
        </div>

        {info && c.kind === 'sound' && (
          <ul className="steps">
            {info.steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
            <li className={info.pose.voiced ? 'steps__voice on' : 'steps__voice'}><span>{info.pose.voiced ? '〰' : '·'}</span>{info.pose.voiced ? 'Voice ON — feel your throat buzz' : 'Voice OFF — just air'}</li>
          </ul>
        )}

        <div className="wordsheet__audio">
          <button type="button" className="pill" onClick={() => onListen(false)}><Icon name="speaker" size={20} />Listen</button>
          <button type="button" className="pill" onClick={() => onListen(true)}><Icon name="turtle" size={20} />Slow</button>
          <button type="button" className="pill" onClick={onHearMe}><Icon name="play" size={16} />Hear my try</button>
        </div>

        {c.detail && band !== 'little' && (
          <div className="detail">
            <button type="button" className="detail__toggle" onClick={() => setMore((m) => !m)} aria-expanded={more}>
              <Icon name="info" size={18} />{more ? 'Hide the details' : 'More about this sound'}
            </button>
            {more && <p className="detail__body">{c.detail}{word.syllables.length > 1 && <> Syllables: {word.syllables.map((s) => `${s.text} (${s.score})`).join(' · ')}.</>}</p>}
          </div>
        )}

        {onRetry ? <Button variant="coral" size="lg" icon="mic" block onClick={onRetry}>Try again</Button> : <Button variant="soft" size="lg" block onClick={onClose}>Got it</Button>}
      </div>
    </Sheet>
  );
}
