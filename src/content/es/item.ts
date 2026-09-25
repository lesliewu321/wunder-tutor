import type { PhonemeId, SpeakItem } from '../../domain/types';

// A Spanish speaking item. Spelling says how it sounds (es/lexicon.ts), so only the text is needed. The id is a
// slug of the text with its accents kept — café and cafe are different words — so the same line shares progress
// wherever it appears: `es-quiero-agua-por-favor`. Used by the TypeScript scenario file; the course data
// (content/courses/es.json) writes the same fields and ids by hand.

export const esId = (text: string): string => `es-${text.toLowerCase().replace(/[^a-zñáéíóúü]+/g, '-').replace(/^-|-$/g, '')}`;

export const esKind = (text: string): SpeakItem['kind'] => {
  const words = text.trim().split(/\s+/).length;
  if (words === 1) return 'word';
  return /[.!?]$/.test(text.trim()) && words > 3 ? 'sentence' : 'phrase';
};

export const es = (text: string, meaning?: string, picture?: string, focus?: PhonemeId[]): SpeakItem => ({
  id: esId(text), text, lang: 'es-ES', picture, meaning, focus, kind: esKind(text),
});
