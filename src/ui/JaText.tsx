import type { AgeBand, Assessment, JaText as Reading, SpeakItem } from '../domain/types';
import { t } from '../i18n';
import { morae, needsReading, writtenKana } from '../content/ja/kana';
import { tier } from '../tutor/feedback';

/**
 * One score per beat of the reading, with the scored word it came from — or null when the scores are not beats
 * (Azure's words could not be lined up with them).
 */
export const beatScores = (reading: Reading, assessment: Assessment): { score: number; word: number }[] | null => {
  const scores = assessment.words.flatMap((w, word) => (w.errorType === 'omission' ? [] : w.phonemes.map((p) => ({ score: p.score, word }))));
  return scores.length && scores.length === morae(reading.kana).length ? scores : null;
};

/**
 * A scored Japanese line, beat by beat: each beat of the reading coloured by its own score, so one weak ら does not
 * paint the whole sentence red. A marked beat opens the help for its word, like a coloured word in any other course.
 * Null when the scores are not one per beat — the caller then shows the scorer's words instead.
 */
export function JaBeats({ reading, assessment, onTap }: { reading: Reading; assessment: Assessment; onTap?: (word: number) => void }) {
  // Shown as written (こんにちは), scored as said (こんにちわ): the two have the same beats.
  const beats = morae(writtenKana(reading));
  const scores = beatScores(reading, assessment);
  if (!scores || beats.length !== scores.length) return null;
  return (
    <span className="ja">
      <span className="ja__line" lang="ja">
        {beats.map((b, i) => {
          const { score, word } = scores[i];
          const cls = `ja-beat ja-beat--${tier(score)}`;
          return onTap && tier(score) !== 'good'
            ? <button key={i} type="button" className={cls} onClick={() => onTap(word)} aria-label={t('speak.word.aria', { word: b.kana, score })}>{b.kana}</button>
            : <span key={i} className={cls}>{b.kana}</span>;
        })}
      </span>
      <span className="ja__romaji" lang="ja-Latn">{reading.romaji}</span>
    </span>
  );
}

interface Props {
  item: Pick<SpeakItem, 'text'> & { ja: Reading };
  band: AgeBand;
  /** Romaji under the line, for a learner who cannot read kana yet. */
  showRomaji?: boolean;
  className?: string;
}

/**
 * A Japanese line as a learner reads it: kanji with their kana printed over them (furigana), and romaji underneath.
 * A five-to-seven-year-old sees the line in kana alone — furigana over kanji is a lot to look at when you cannot read
 * either yet, and the kana is exactly what is said.
 */
export function JaText({ item, band, showRomaji = true, className = '' }: Props) {
  const little = band === 'little';
  return (
    <span className={`ja ${className}`}>
      <span className="ja__line" lang="ja">
        {little ? writtenKana(item.ja) : item.ja.ruby.map((piece, i) => (needsReading(piece)
          ? <ruby key={i} className="ja__ruby">{piece.text}<rp>(</rp><rt className="ja__kana">{piece.reading}</rt><rp>)</rp></ruby>
          : <span key={i}>{piece.text}</span>))}
      </span>
      {showRomaji && <span className="ja__romaji" lang="ja-Latn">{item.ja.romaji}</span>}
    </span>
  );
}
