import type { AgeBand, KoText as Reading } from '../domain/types';

/**
 * A Korean line as written, with its romanisation under it for a learner who cannot read hangul yet. The hangul stays
 * the thing to read: the romaja is small, and gone for grown-ups who have opted to read hangul only (later).
 */
export function KoText({ item, band }: { item: { text: string; ko: Reading }; band: AgeBand }) {
  void band;
  return (
    <span className="ko">
      <span className="ko__line" lang="ko">{item.text}</span>
      <small className="ko__romaja" lang="ko-Latn">{item.ko.romaja}</small>
    </span>
  );
}
