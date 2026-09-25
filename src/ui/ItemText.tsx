import type { AgeBand, SpeakItem } from '../domain/types';
import type { ZhScript } from '../content/zh/script';
import { JaText } from './JaText';
import { KoText } from './KoText';
import { ZhText } from './ZhText';

/**
 * Any practice line in its own writing: Chinese in the learner's characters with pinyin, Japanese with furigana and
 * romaji, French and English as written. One place, so a screen that shows a line shows every course's lines right.
 */
export function ItemText({ item, band, script }: { item: SpeakItem; band: AgeBand; script: ZhScript }) {
  if (item.yue) return <span className="yue-text" lang="yue-HK"><span>{item.text}</span><small className="yue-text__reading" lang="yue-Latn">{item.yue.jyutping}</small></span>;
  if (item.zh) return <ZhText item={item} script={script} />;
  if (item.ja) return <JaText item={{ text: item.text, ja: item.ja }} band={band} />;
  if (item.ko) return <KoText item={{ text: item.text, ko: item.ko }} band={band} />;
  return <span lang={item.lang === 'fr-FR' ? 'fr' : item.lang === 'es-ES' ? 'es' : undefined}>{item.text}</span>;
}
