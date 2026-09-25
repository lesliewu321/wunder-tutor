import type { HomeLanguage } from '../domain/types';
import { tc } from '../i18n';
import { ITEM_INDEX } from './course';

export const HOME_LANGUAGES: { id: HomeLanguage; label: string; native: string }[] = [
  { id: 'yue', label: 'Cantonese', native: '廣東話' },
  { id: 'en', label: 'English', native: 'English' },
  { id: 'zh', label: 'Mandarin', native: '普通话' },
  { id: 'es', label: 'Spanish', native: 'Español' },
  { id: 'de', label: 'German', native: 'Deutsch' },
  { id: 'fr', label: 'French', native: 'Français' },
  { id: 'pt', label: 'Portuguese', native: 'Português' },
  { id: 'ja', label: 'Japanese', native: '日本語' },
  { id: 'ko', label: 'Korean', native: '한국어' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'ar', label: 'Arabic', native: 'العربية' },
  { id: 'other', label: 'Another language', native: '🌍' },
];

/** A home language's name in the app's language (the list above keeps the English). */
export const homeLanguageLabel = (id: HomeLanguage): string => tc(`homeLanguage.${id}`, HOME_LANGUAGES.find((l) => l.id === id)?.label ?? id);

// "Speak from a translation" prompts live with their items in the course data (content/courses/<language>.json,
// `translations` on an item). Where a home language has no entry the exercise falls back to a picture prompt.
export const translationFor = (itemId: string, lang: HomeLanguage): string | undefined => ITEM_INDEX[itemId]?.translations?.[lang];
