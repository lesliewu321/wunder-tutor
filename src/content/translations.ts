import type { HomeLanguage } from '../domain/types';
import { tc } from '../i18n';

export const HOME_LANGUAGES: { id: HomeLanguage; label: string; native: string }[] = [
  { id: 'yue', label: 'Cantonese', native: '廣東話' },
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

type T = Partial<Record<HomeLanguage, string>>;

// Translations for "speak from a translation" prompts, keyed by SpeakItem id.
// Where a home language has no entry the exercise falls back to a picture prompt.
export const TRANSLATIONS: Record<string, T> = {
  'it-can-i-have-some-water-please': {
    yue: '可以給我一些水嗎？', es: '¿Me das un poco de agua, por favor?', zh: '请给我一些水，好吗？', de: 'Kann ich bitte etwas Wasser haben?', fr: 'Je peux avoir de l’eau, s’il vous plaît ?',
    pt: 'Posso tomar um pouco de água, por favor?', ja: 'お水をもらえますか？', ko: '물 좀 주시겠어요?', hi: 'क्या मुझे थोड़ा पानी मिल सकता है?', ar: 'هل يمكنني الحصول على بعض الماء من فضلك؟',
  },
  'it-thank-you-very-much': {
    yue: '非常感謝。', es: 'Muchas gracias.', zh: '非常感谢。', de: 'Vielen Dank.', fr: 'Merci beaucoup.', pt: 'Muito obrigado.', ja: 'どうもありがとうございます。', ko: '정말 감사합니다.', hi: 'बहुत-बहुत धन्यवाद।', ar: 'شكراً جزيلاً.',
  },
  'it-i-would-like-a-cup-of-hot-chocolate': {
    yue: '我想要一杯熱朱古力。', es: 'Quisiera una taza de chocolate caliente.', zh: '我想要一杯热巧克力。', de: 'Ich hätte gern eine Tasse heiße Schokolade.', fr: 'Je voudrais une tasse de chocolat chaud.',
    pt: 'Eu queria uma xícara de chocolate quente.', ja: 'ホットチョコレートを一杯ください。', ko: '핫초코 한 잔 주세요.', hi: 'मुझे एक कप हॉट चॉकलेट चाहिए।', ar: 'أريد كوباً من الشوكولاتة الساخنة.',
  },
  'it-could-i-have-the-menu-please': {
    yue: '可以給我餐牌嗎？', es: '¿Me trae el menú, por favor?', zh: '请给我菜单，好吗？', de: 'Könnte ich bitte die Speisekarte haben?', fr: 'Pourrais-je avoir le menu, s’il vous plaît ?',
    pt: 'Poderia me trazer o cardápio, por favor?', ja: 'メニューをいただけますか？', ko: '메뉴판 좀 주시겠어요?', hi: 'क्या मुझे मेन्यू मिल सकता है?', ar: 'هل يمكنني الحصول على قائمة الطعام من فضلك؟',
  },
  'it-what-do-you-recommend': {
    yue: '你有什麼推介？', es: '¿Qué me recomienda?', zh: '你推荐什么？', de: 'Was empfehlen Sie?', fr: 'Que recommandez-vous ?', pt: 'O que você recomenda?', ja: 'おすすめは何ですか？', ko: '무엇을 추천하시나요?', hi: 'आप क्या सुझाव देंगे?', ar: 'بماذا تنصح؟',
  },
  'it-that-sounds-great-thank-you': {
    yue: '聽起來很不錯，謝謝。', es: 'Suena genial, gracias.', zh: '听起来很棒，谢谢。', de: 'Das klingt super, danke.', fr: 'Ça a l’air super, merci.', pt: 'Parece ótimo, obrigado.', ja: 'いいですね、ありがとう。', ko: '좋아요, 감사합니다.', hi: 'यह बढ़िया लगता है, धन्यवाद।', ar: 'يبدو رائعاً، شكراً لك.',
  },
};

export const translationFor = (itemId: string, lang: HomeLanguage): string | undefined => TRANSLATIONS[itemId]?.[lang];
