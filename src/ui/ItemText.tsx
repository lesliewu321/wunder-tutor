import type { AgeBand, SpeakItem } from '../domain/types';
import type { ZhScript } from '../content/zh/script';
import { JaText } from './JaText';
import { ZhText } from './ZhText';

/**
 * Any practice line in its own writing: Chinese in the learner's characters with pinyin, Japanese with furigana and
 * romaji, French and English as written. One place, so a screen that shows a line shows every course's lines right.
 */
export function ItemText({ item, band, script }: { item: SpeakItem; band: AgeBand; script: ZhScript }) {
  if (item.zh) return <ZhText item={item} script={script} />;
  if (item.ja) return <JaText item={{ text: item.text, ja: item.ja }} band={band} />;
  return <span lang={item.lang === 'fr-FR' ? 'fr' : undefined}>{item.text}</span>;
}
