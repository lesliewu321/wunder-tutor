import { useState } from 'react';
import { isGrownUp, type AgeBand, type HomeLanguage, type WordScore } from '../../domain/types';
import { phonemeInfo } from '../../content/phonemes';
import { markSyllable } from '../../content/zh/pinyin';
import { rich, useT } from '../../i18n/useT';
import { correctionFor, sentences, tier } from '../../tutor/feedback';
import { Button, Sheet } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { Mouth } from '../../ui/Mouth';
import { ToneContour } from '../../ui/ToneContour';

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

/** Diagnose → teach for a single word (or Mandarin syllable): the exact sound or tone, what happened, what to do. */
export function WordSheet({ word, band, home, onClose, onListen, onHearMe, onHearTip, onRetry }: Props) {
  const { t } = useT();
  const [more, setMore] = useState(false);
  const c = correctionFor(word, band, home);
  const info = c.phoneme ? phonemeInfo(c.phoneme) : null;
  const z = word.syllables[0]?.zh;
  const grownUp = isGrownUp(band);

  return (
    <Sheet open onClose={onClose} label={t('speak.sheet.aria', { word: word.word })}>
      <div className="wordsheet">
        <div className="wordsheet__head">
          <h2 className="wordsheet__word">{word.word}{z && <span className="wordsheet__py">{markSyllable(z.py)}</span>}</h2>
          <span className={`chip-score chip-score--${tier(word.score)}`}>{word.errorType === 'omission' ? t('speak.score.missed') : word.score}</span>
        </div>

        {z ? (
          word.errorType !== 'omission' && (
            <div className="sounds" aria-label={t('speak.sheet.syllable.aria')}>
              <span className={`sound sound--${tier(z.heardAs ? Math.min(z.soundScore, 55) : z.soundScore)}`}><b>{t('speak.sheet.syllable.sounds')}</b><small>{z.heardAs ? t('speak.sheet.syllable.sounds.like', { pinyin: markSyllable(z.heardAs) }) : z.soundScore}</small></span>
              {z.accept[0] !== 5 && (
                <span className={`sound sound--${z.toneScore == null ? 'okay' : tier(z.toneScore)}`}><b>{t(`speak.sheet.syllable.tone.${z.accept[0] as 1 | 2 | 3 | 4}`)}</b><small>{z.toneHeard ? t(`speak.sheet.syllable.heard.${z.toneHeard}`) : z.toneScore ?? t('speak.sheet.syllable.notMeasured')}</small></span>
              )}
            </div>
          )
        ) : word.phonemes.length > 0 && (
          <div className="sounds" aria-label={t('speak.sheet.sounds.aria')}>
            {word.phonemes.map((p, i) => (
              <span key={i} className={`sound sound--${tier(p.score)} ${p.phoneme === c.phoneme ? 'sound--focus' : ''}`}>
                <b>{grownUp ? `/${p.phoneme}/` : phonemeInfo(p.phoneme).label}</b><small>{p.score}</small>
              </span>
            ))}
          </div>
        )}

        <div className="teach">
          <p className="teach__problem">{c.problem}</p>
          <div className="teach__row">
            {c.kind === 'tone' && c.zh && c.zh.expected !== 5
              ? <div className="teach__mouth"><ToneContour tone={c.zh.expected as 1 | 2 | 3 | 4} yours={c.zh.contour} context={z?.context} size={132} /></div>
              : info && c.kind === 'sound' && info.category !== 'tone' && <div className="teach__mouth"><Mouth pose={info.pose} size={132} /></div>}
            <p className="teach__tip">{rich(t('speak.try', { tip: c.tip }))}</p>
          </div>
          <button type="button" className="teach__say" onClick={() => onHearTip(c.tip)}><Icon name="speaker" size={18} />{t(band === 'adult' ? 'speak.sheet.hearTip.adult' : 'speak.sheet.hearTip.kid')}</button>
        </div>

        {info && (c.kind === 'sound' || c.kind === 'tone') && (
          <ul className="steps">
            {info.steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
            {info.category !== 'tone' && <li className={info.pose.voiced ? 'steps__voice on' : 'steps__voice'}><span>{info.pose.voiced ? '〰' : '·'}</span>{t(info.pose.voiced ? 'speak.sheet.voice.on' : 'speak.sheet.voice.off')}</li>}
          </ul>
        )}

        <div className="wordsheet__audio">
          <button type="button" className="pill" onClick={() => onListen(false)}><Icon name="speaker" size={20} />{t('common.listen')}</button>
          <button type="button" className="pill" onClick={() => onListen(true)}><Icon name="turtle" size={20} />{t('common.slow')}</button>
          <button type="button" className="pill" onClick={onHearMe}><Icon name="play" size={16} />{t('speak.sheet.hearMe')}</button>
        </div>

        {c.detail && band !== 'little' && (
          <div className="detail">
            <button type="button" className="detail__toggle" onClick={() => setMore((m) => !m)} aria-expanded={more}>
              <Icon name="info" size={18} />{more ? t('speak.sheet.detail.hide') : z ? t('speak.sheet.detail.show') : t('speak.sheet.detail.show.sound')}
            </button>
            {more && <p className="detail__body">{sentences(c.detail, !z && word.syllables.length > 1 && t('speak.sheet.detail.syllables', { list: word.syllables.map((s) => `${s.text} (${s.score})`).join(' · ') }))}</p>}
          </div>
        )}

        {onRetry ? <Button variant="coral" size="lg" icon="mic" block onClick={onRetry}>{t('common.tryAgain')}</Button> : <Button variant="soft" size="lg" block onClick={onClose}>{t('speak.sheet.gotIt')}</Button>}
      </div>
    </Sheet>
  );
}
